from fastapi import FastAPI
from app.db.session import initialize_db_pool
from app.api.endpoints.shopping_assistant import router as shopping_assistant_router

app = FastAPI(title="TAIC AI Services")

@app.on_event("startup")
async def startup_event():
    print("Application startup: Initializing database pool via main.py event...")
    initialize_db_pool()

@app.get("/")
async def root():
    return {"message": "TAIC AI Services are running."}

app.include_router(
    shopping_assistant_router,
    prefix="/api/v1/shopping_assistant",
    tags=["Shopping Assistant"]
)
