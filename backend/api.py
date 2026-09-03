from fastapi import FastAPI

from library import env
from library.sentry import XSentry

XSentry.init("api")

from components.auth import routes as auth_routes
from components.profiles import routes as profile_routes
from components.results import routes as result_routes
from components.sources import routes as source_routes

app = FastAPI()
app.include_router(auth_routes.router)
app.include_router(profile_routes.router)
app.include_router(result_routes.router)
app.include_router(source_routes.router)
