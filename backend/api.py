from fastapi import FastAPI

from auth import routes as auth_routes
from profiles import routes as profile_routes
from results import routes as result_routes
from sources import routes as source_routes

app = FastAPI()
app.include_router(auth_routes.router)
app.include_router(profile_routes.router)
app.include_router(result_routes.router)
app.include_router(source_routes.router)
