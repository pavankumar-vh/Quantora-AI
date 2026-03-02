"""
main.py — Quantora AI Backend API Server
==========================================

FastAPI application serving the SAGRA (Sentinel Adaptive Graph Risk Algorithm)
as a production-ready REST API.

Architecture:
    ┌──────────────┐     POST /predict     ┌──────────────┐
    │   Frontend    │ ──────────────────▶  │   FastAPI     │
    │  (Next.js)    │ ◀──────────────────  │   Backend     │
    └──────────────┘    { risk_score,      └──────┬───────┘
                          fraud_prediction }       │
                                                   │
                                          ┌────────▼────────┐
                                          │  Graph Engine    │
                                          │  (NetworkX)      │
                                          └────────┬────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │    SAGRA         │
                                          │  (sentinel.py)   │
                                          └─────────────────┘

Separation of Concerns:
    - main.py       → HTTP layer, request validation, response formatting
    - graph_engine  → Graph state management, centrality computation
    - sentinel      → Pure risk scoring algorithm (no I/O, no side effects)

SAGRA was validated in "SAGRA — Sentinel Adaptive Graph Risk Algorithm.ipynb".
Fraud patterns were injected synthetically (fan-out attack simulation).
Accuracy was benchmarked against ground-truth labels.
This backend now runs the production-ready modular version,
demonstrating a research → validation → deployment pipeline.

Production Scalability Notes:
    - Current system uses in-memory graph for demo purposes.
    - Enterprise deployment would:
        • Use Neo4j or distributed graph DB for persistence
        • Use streaming ingestion (Apache Kafka) for real-time feeds
        • Deploy behind a load balancer with horizontal scaling
        • Maintain <200ms inference time per prediction
        • Add authentication, rate limiting, and audit logging
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Modular imports — clean separation of concerns ──
from graph_engine import transaction_graph
from sentinel import run_sagra

# ─────────────────────────────────────────────────────
# App Initialization
# ─────────────────────────────────────────────────────

app = FastAPI(
    title="Quantora AI — SAGRA Backend",
    description=(
        "Production API for the Sentinel Adaptive Graph Risk Algorithm (SAGRA). "
        "Receives transaction data, builds a live transaction graph, computes "
        "graph-based risk features, and returns fraud predictions."
    ),
    version="1.0.0",
)

# ── CORS configuration ──────────────────────────────
# Allow the Next.js frontend to communicate with the backend.
# In production, restrict origins to the specific frontend domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production: replace with ["https://quantora.ai"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────
# Request / Response Models
# ─────────────────────────────────────────────────────

class TransactionRequest(BaseModel):
    """
    Input schema for the /predict endpoint.

    Attributes:
        sender: Sender account ID (integer).
        receiver: Receiver account ID (integer).
        amount: Transaction amount in USD (positive float).
    """
    sender: int = Field(..., description="Sender account ID")
    receiver: int = Field(..., description="Receiver account ID")
    amount: float = Field(..., gt=0, description="Transaction amount in USD")


class PredictionResponse(BaseModel):
    """
    Output schema for the /predict endpoint.

    Attributes:
        risk_score: SAGRA Final Risk Score (FRS) in [0, 1].
        fraud_prediction: Binary fraud decision (1 = fraud, 0 = safe).
    """
    risk_score: float = Field(..., description="SAGRA risk score (0 to 1)")
    fraud_prediction: int = Field(..., description="1 = fraud, 0 = safe")


class DetailedPredictionResponse(PredictionResponse):
    """
    Extended response with full SAGRA component breakdown.
    Useful for debugging, explainability, and dashboard display.
    """
    trs: float = Field(..., description="Transaction Risk Score")
    grs: float = Field(..., description="Graph Risk Score")
    ndb: float = Field(..., description="Network Density Boost")
    sender_degree: float = Field(..., description="Sender degree centrality")
    graph_stats: dict = Field(..., description="Current graph statistics")


# ─────────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────────

@app.post("/predict", response_model=PredictionResponse)
async def predict(transaction: TransactionRequest):
    """
    Predict fraud risk for a transaction using the SAGRA algorithm.

    Flow:
        1. Add the transaction to the in-memory graph.
        2. Compute sender's degree centrality from the graph.
        3. Run the SAGRA algorithm with amount + sender_degree.
        4. Return risk_score and fraud_prediction.

    Args:
        transaction: TransactionRequest with sender, receiver, amount.

    Returns:
        PredictionResponse with risk_score and fraud_prediction.
    """
    # Step 1: Add transaction edge to the graph
    transaction_graph.add_transaction(
        sender=transaction.sender,
        receiver=transaction.receiver,
        amount=transaction.amount,
    )

    # Step 2: Compute sender degree centrality
    sender_degree = transaction_graph.get_sender_degree(transaction.sender)

    # Step 3: Execute SAGRA algorithm
    result = run_sagra(amount=transaction.amount, sender_degree=sender_degree)

    # Step 4: Return prediction
    return PredictionResponse(
        risk_score=result.risk_score,
        fraud_prediction=result.fraud_prediction,
    )


@app.post("/predict/detailed", response_model=DetailedPredictionResponse)
async def predict_detailed(transaction: TransactionRequest):
    """
    Detailed prediction endpoint with full SAGRA component breakdown.

    Includes TRS, GRS, NDB, sender_degree, and graph statistics.
    Intended for the frontend dashboard and debugging.
    """
    # Step 1: Add transaction to graph
    transaction_graph.add_transaction(
        sender=transaction.sender,
        receiver=transaction.receiver,
        amount=transaction.amount,
    )

    # Step 2: Compute sender degree centrality
    sender_degree = transaction_graph.get_sender_degree(transaction.sender)

    # Step 3: Execute SAGRA
    result = run_sagra(amount=transaction.amount, sender_degree=sender_degree)

    # Step 4: Return detailed response
    return DetailedPredictionResponse(
        risk_score=result.risk_score,
        fraud_prediction=result.fraud_prediction,
        trs=result.trs,
        grs=result.grs,
        ndb=result.ndb,
        sender_degree=round(sender_degree, 4),
        graph_stats=transaction_graph.get_graph_stats(),
    )


@app.get("/graph/stats")
async def graph_stats():
    """
    Return current graph statistics.

    Useful for the frontend dashboard to display network health metrics.
    """
    return transaction_graph.get_graph_stats()


@app.post("/graph/reset")
async def reset_graph():
    """
    Reset the transaction graph. Clears all nodes and edges.

    Used for testing and demo resets. In production, this endpoint
    would be restricted to admin users only.
    """
    transaction_graph.reset()
    return {"status": "Graph reset successfully", "graph_stats": transaction_graph.get_graph_stats()}


@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring and load balancer probes.
    """
    return {
        "status": "healthy",
        "algorithm": "SAGRA v1.0",
        "graph_nodes": transaction_graph.node_count,
        "graph_edges": transaction_graph.edge_count,
    }


# ─────────────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    # Run on port 8000 — frontend proxies to this via next.config.js rewrites
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
