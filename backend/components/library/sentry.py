import functools
import os
import re

from components.library import env

try:
    import sentry_sdk
    from sentry_sdk.transport import Transport
    SENTRY_AVAILABLE = True
except ImportError:
    SENTRY_AVAILABLE = False
    sentry_sdk = None
    Transport = None

_sensitive_key_pattern = re.compile(
    r"password|passwd|secret|token|authorization|session|cookie|anon|email", re.I
)
_email_pattern = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def _scrub(value):
    if isinstance(value, dict):
        scrubbed = {}
        for name, item in value.items():
            if isinstance(name, str) and _sensitive_key_pattern.search(name):
                scrubbed[name] = "[scrubbed]"
            else:
                scrubbed[name] = _scrub(item)
        return scrubbed
    if isinstance(value, (list, tuple)):
        return [_scrub(item) for item in value]
    if isinstance(value, str):
        return _email_pattern.sub("[email]", value)
    return value


def _is_expected(error) -> bool:
    if error is None:
        return False
    if type(error).__name__ == "SoftBlocked":
        return True
    status = getattr(error, "status_code", None)
    if isinstance(status, int) and status < 500:
        return True
    response_status = getattr(getattr(error, "response", None), "status_code", None)
    return response_status in (403, 404, 999)


def _before_send(event, hint):
    exc_info = hint.get("exc_info") if hint else None
    if exc_info and _is_expected(exc_info[1]):
        return None
    return _scrub(event)


class XSentry:

    @staticmethod
    def init(component: str):
        if not SENTRY_AVAILABLE:
            return
        dsn = os.environ.get("SENTRY_DSN", "").strip()
        if not dsn:
            # No DSN configured: error telemetry stays disabled.
            return
        sentry_sdk.init(
            dsn=dsn,
            traces_sample_rate=1.0,
            send_default_pii=True,
            environment=os.environ.get("SENTRY_ENVIRONMENT", "development"),
            release=os.environ.get("SENTRY_RELEASE", f"jobsearch-{component}@0.1.0"),
            before_send=_before_send,
        )
        sentry_sdk.set_tag("process", component)

    @staticmethod
    def start_transaction(name: str, op='task'):
        if not SENTRY_AVAILABLE:
            return _NoOpTransaction()
        transaction = sentry_sdk.start_transaction(name=name, op=op)
        sentry_sdk.get_current_scope().span = transaction
        return transaction

    @staticmethod
    def start_span(description: str, op='block'):
        if not SENTRY_AVAILABLE:
            return _NoOpSpan()
        return sentry_sdk.start_span(name=description, op=op)

    @staticmethod
    def capture_exception(exc, tags=None, fingerprint=None, extras=None):
        if not SENTRY_AVAILABLE:
            return
        if _is_expected(exc):
            return
        with sentry_sdk.new_scope() as scope:
            for name, value in (extras or {}).items():
                scope.set_extra(name, value)
            for name, value in (tags or {}).items():
                scope.set_tag(name, value)
            if fingerprint:
                scope.fingerprint = list(fingerprint)
            sentry_sdk.capture_exception(exc)

    @staticmethod
    def capture_message(message, severity='info', tags=None, fingerprint=None, extras=None):
        if not SENTRY_AVAILABLE:
            return
        with sentry_sdk.new_scope() as scope:
            for name, value in (extras or {}).items():
                scope.set_extra(name, value)
            for name, value in (tags or {}).items():
                scope.set_tag(name, value)
            if fingerprint:
                scope.fingerprint = list(fingerprint)
            sentry_sdk.capture_message(message, level=severity)

    @staticmethod
    def set_tag(name: str, value: str):
        if not SENTRY_AVAILABLE:
            return
        sentry_sdk.set_tag(name, value)

    @staticmethod
    def add_breadcrumb(message: str, category='default', level='info'):
        if not SENTRY_AVAILABLE:
            return
        sentry_sdk.add_breadcrumb(message=message, category=category, level=level)

    @staticmethod
    def wrap_span(description=None, op="block"):
        def decorator(func):
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                desc = description or f"{func.__module__}.{func.__qualname__}"
                span = XSentry.start_span(desc, op)
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    XSentry.capture_exception(e)
                    raise
                finally:
                    span.finish()
            return wrapper
        return decorator

    @staticmethod
    def wrap_transaction(name=None, op="task"):
        def decorator(func):
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                tx_name = name or f"{func.__module__}.{func.__qualname__}"
                tx = XSentry.start_transaction(tx_name, op)
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    XSentry.capture_exception(e)
                    raise
                finally:
                    tx.finish()
            return wrapper
        return decorator


if SENTRY_AVAILABLE:
    class XSentryTransport(Transport):
        def capture_envelope(self, envelope):
            # Send synchronously here if needed (e.g., via requests.post)
            pass  # totally noop, disables ALL sending


class _NoOpTransaction:
    """No-op transaction for when Sentry is unavailable"""
    def __enter__(self):
        return self
    def __exit__(self, *args):
        pass
    def finish(self):
        pass


class _NoOpSpan:
    """No-op span for when Sentry is unavailable"""
    def __enter__(self):
        return self
    def __exit__(self, *args):
        pass
    def finish(self):
        pass
