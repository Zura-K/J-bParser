listings = "Listings"
fingerprints = "Fingerprints"
queue_ingest = "Queue:Ingest"


def listing(listing_id: str) -> str:
    return f"Listing:{listing_id}"


def user(user_id: str) -> str:
    return f"User:{user_id}"


def user_by_email(email: str) -> str:
    return f"UserByEmail:{email}"


def session(token: str) -> str:
    return f"Session:{token}"


def profile(user_id: str, profile_id: str) -> str:
    return f"Profile:{user_id}:{profile_id}"


def dismissed(user_id: str) -> str:
    return f"Dismissed:{user_id}"


def source(source_key: str) -> str:
    return f"Source:{source_key}"


def raw(url_hash: str) -> str:
    return f"Raw:{url_hash}"


def queue_processing(worker_id: str) -> str:
    return f"Queue:Processing:{worker_id}"


def embed_count(user_id: str) -> str:
    return f"EmbedCount:{user_id}"
