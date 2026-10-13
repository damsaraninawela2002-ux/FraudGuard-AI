"""Transactions API endpoints for filtering, pagination, stats, CSV export, and deletion.

FraudGuard AI – Explainable Fraud Detection System
"""

import csv
from datetime import datetime, timedelta, timezone
import io
import logging
import re
from typing import Any, AsyncGenerator, Dict, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.core.security import get_current_admin, get_current_user
from app.db.mongodb import get_database
from app.schemas.transaction import (
    DailyFraudStat,
    PaginatedTransactions,
    TransactionOut,
    TransactionStats,
)

logger = logging.getLogger("fraudguard.routes_transactions")

router = APIRouter(prefix="/api", tags=["Transactions"])


def serialize_transaction_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure MongoDB ObjectId is converted to string for Pydantic serialization."""
    item = dict(doc)
    if "_id" in item:
        item["_id"] = str(item["_id"])
        item["id"] = item["_id"]
    return item


def build_transaction_filter(
    risk_level: Optional[str] = None,
    prediction: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Construct MongoDB query dictionary based on applied filters."""
    query: Dict[str, Any] = {}

    if risk_level:
        query["risk_level"] = risk_level

    if prediction:
        query["prediction"] = prediction

    if search:
        escaped_search = re.escape(search.strip())
        query["transaction_id"] = {"$regex": escaped_search, "$options": "i"}

    if date_from or date_to:
        date_query: Dict[str, Any] = {}
        if date_from:
            date_query["$gte"] = date_from
        if date_to:
            date_query["$lte"] = date_to
        query["created_at"] = date_query

    return query


@router.get(
    "/transactions",
    response_model=PaginatedTransactions,
    summary="List transactions with filtering and pagination",
    description="Retrieve paginated transaction records sorted by created_at descending.",
)
async def list_transactions(
    page: int = Query(default=1, ge=1, description="Page number (1-based index)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page (max 100)"),
    risk_level: Optional[str] = Query(default=None, description="Filter by risk tier (Low, Medium, High)"),
    prediction: Optional[str] = Query(default=None, description="Filter by prediction (Potential Fraud, Likely Legitimate)"),
    search: Optional[str] = Query(default=None, description="Search by transaction_id substring"),
    date_from: Optional[datetime] = Query(default=None, description="Filter transactions created on or after"),
    date_to: Optional[datetime] = Query(default=None, description="Filter transactions created on or before"),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> PaginatedTransactions:
    """Fetch paginated, filtered transaction history records."""
    db = get_database()
    query = build_transaction_filter(
        risk_level=risk_level,
        prediction=prediction,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )

    total = await db["transactions"].count_documents(query)
    skip = (page - 1) * page_size

    cursor = (
        db["transactions"]
        .find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(page_size)
    )
    records = await cursor.to_list(length=page_size)
    serialized_items = [TransactionOut(**serialize_transaction_doc(doc)) for doc in records]

    return PaginatedTransactions(
        items=serialized_items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/stats",
    response_model=TransactionStats,
    summary="Aggregation metrics for transaction monitoring dashboard",
    description="Calculates total evaluated records, fraud rates, risk breakdowns, and 30-day timeline.",
)
@router.get(
    "/transactions/stats",
    response_model=TransactionStats,
    include_in_schema=False,
)
async def get_transaction_stats(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> TransactionStats:
    """Aggregate total analyzed count, fraud count, risk distributions, and 30-day daily fraud."""
    db = get_database()

    # 1. Total volume and potential fraud counts
    total_analyzed = await db["transactions"].count_documents({})
    potential_fraud_count = await db["transactions"].count_documents({"prediction": "Potential Fraud"})

    # 2. Risk level breakdown aggregation
    risk_pipeline = [
        {"$group": {"_id": "$risk_level", "count": {"$sum": 1}}}
    ]
    risk_cursor = await db["transactions"].aggregate(risk_pipeline).to_list(length=10)
    risk_level_counts: Dict[str, int] = {"Low": 0, "Medium": 0, "High": 0}
    for item in risk_cursor:
        lvl = item.get("_id")
        if lvl in risk_level_counts:
            risk_level_counts[lvl] = item.get("count", 0)
        elif lvl:
            risk_level_counts[str(lvl)] = item.get("count", 0)

    # 3. Fraud count per day for the last 30 days
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    daily_pipeline = [
        {
            "$match": {
                "created_at": {"$gte": thirty_days_ago},
                "prediction": "Potential Fraud",
            }
        },
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                },
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
        {"$project": {"date": "$_id", "count": 1, "_id": 0}},
    ]
    daily_cursor = await db["transactions"].aggregate(daily_pipeline).to_list(length=35)
    fraud_per_day = [
        DailyFraudStat(date=row["date"], count=row["count"]) for row in daily_cursor
    ]

    return TransactionStats(
        total_analyzed=total_analyzed,
        potential_fraud_count=potential_fraud_count,
        counts_per_risk_level=risk_level_counts,
        risk_level_counts=risk_level_counts,
        fraud_per_day=fraud_per_day,
    )


@router.get(
    "/report/export",
    summary="Export filtered transactions as downloadable CSV file",
    description="Streams a formatted CSV file of transactions matching the specified query filters.",
)
@router.get(
    "/transactions/export",
    include_in_schema=False,
)
async def export_transactions_csv(
    risk_level: Optional[str] = Query(default=None),
    prediction: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> StreamingResponse:
    """Stream filtered transaction records as CSV attachment."""
    db = get_database()
    query = build_transaction_filter(
        risk_level=risk_level,
        prediction=prediction,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )

    async def generate_csv() -> AsyncGenerator[str, None]:
        output = io.StringIO()
        writer = csv.writer(output)

        headers = [
            "transaction_id",
            "created_at",
            "prediction",
            "risk_score",
            "risk_level",
            "amount",
            "transaction_type",
            "hour_of_day",
            "old_balance_origin",
            "new_balance_origin",
            "old_balance_dest",
            "new_balance_dest",
            "recommendation",
            "analyzed_by",
        ]
        writer.writerow(headers)
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)

        cursor = db["transactions"].find(query).sort("created_at", -1)
        async for doc in cursor:
            created_val = doc.get("created_at", "")
            created_str = (
                created_val.isoformat()
                if hasattr(created_val, "isoformat")
                else str(created_val)
            )
            row = [
                doc.get("transaction_id", ""),
                created_str,
                doc.get("prediction", ""),
                doc.get("risk_score", ""),
                doc.get("risk_level", ""),
                doc.get("amount", ""),
                doc.get("transaction_type", ""),
                doc.get("hour_of_day", ""),
                doc.get("old_balance_origin", ""),
                doc.get("new_balance_origin", ""),
                doc.get("old_balance_dest", ""),
                doc.get("new_balance_dest", ""),
                doc.get("recommendation", ""),
                doc.get("analyzed_by", ""),
            ]
            writer.writerow(row)
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    return StreamingResponse(
        generate_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="transactions_report.csv"'},
    )


@router.get(
    "/transactions/{transaction_id}",
    response_model=TransactionOut,
    summary="Get single transaction by ID",
    description="Retrieve full transaction details including ML score and SHAP attributions.",
)
async def get_transaction(
    transaction_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> TransactionOut:
    """Retrieve single transaction record by business transaction_id or MongoDB ObjectId."""
    db = get_database()
    doc = await db["transactions"].find_one({"transaction_id": transaction_id})

    if not doc and ObjectId.is_valid(transaction_id):
        doc = await db["transactions"].find_one({"_id": ObjectId(transaction_id)})

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction '{transaction_id}' not found",
        )

    return TransactionOut(**serialize_transaction_doc(doc))


@router.delete(
    "/transactions/{transaction_id}",
    summary="Delete transaction (Admin only)",
    description="Deletes a transaction record from the database. Requires admin privileges.",
)
async def delete_transaction(
    transaction_id: str,
    admin_user: Dict[str, Any] = Depends(get_current_admin),
) -> Dict[str, Any]:
    """Delete a transaction record. Accessible exclusively to administrators."""
    db = get_database()
    result = await db["transactions"].delete_one({"transaction_id": transaction_id})

    if result.deleted_count == 0 and ObjectId.is_valid(transaction_id):
        result = await db["transactions"].delete_one({"_id": ObjectId(transaction_id)})

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction '{transaction_id}' not found",
        )

    logger.info("Transaction %s deleted by admin %s", transaction_id, admin_user.get("email"))
    return {
        "message": "Transaction deleted successfully",
        "transaction_id": transaction_id,
    }
