import inspect
import os
import traceback
from datetime import datetime

from library import sentry as sentry_module
from library.sentry import XSentry

_internal_files = {
    os.path.abspath(__file__),
    os.path.abspath(sentry_module.__file__),
}


def _get_now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _caller_location() -> tuple[str, int, str]:
    frame = inspect.currentframe()
    while frame is not None:
        filename = os.path.abspath(frame.f_code.co_filename)
        if filename not in _internal_files:
            return filename, frame.f_lineno, frame.f_code.co_name
        frame = frame.f_back
    return "unknown", 0, "unknown"


class XErrorLogger(object):

    @staticmethod
    @XSentry.wrap_span("XErrorLogger.LogError")
    def LogError(Exc=None, Msg='❌ Error', Tags=None, Fingerprint=None):
        """Logs exceptions with detailed traceback info and reports to Sentry."""
        try:
            if Exc:
                tb = traceback.extract_tb(Exc.__traceback__)
                if tb:
                    last_entry = tb[-1]
                    filename = last_entry.filename
                    lineno = last_entry.lineno
                    func_name = getattr(last_entry, 'name', 'Unknown')
                    print(f"{_get_now()} ❌[ERROR] {Msg}: {Exc} | 📂 File: {filename} | 📌 Line: {lineno} | 🏷️ Function: {func_name}")
                else:
                    print(f"{_get_now()} ❌[ERROR] {Msg}: {Exc} (⚠️ No traceback available)")
                XSentry.capture_exception(Exc, tags=Tags, fingerprint=Fingerprint)
            else:
                print(f"{_get_now()} ❌[ERROR] {Msg}: (⚠️ No exception object provided)")
        except Exception as e:
            print(f"{_get_now()} ❌ Failed to log error: {e} | 🔄 Original Exception: {Exc}")

    @staticmethod
    @XSentry.wrap_span("XErrorLogger.LogWarning")
    def LogWarning(Msg):
        """Logs warning messages and sends breadcrumb to Sentry."""
        try:
            filename, lineno, func_name = _caller_location()
            print(f"{_get_now()} ⚠️ [WARNING] {Msg} (📂 File: {filename} | 📌 Line: {lineno} | 🏷️ Function: {func_name})")
            XSentry.add_breadcrumb(message=Msg, category="warning", level="warning")
        except Exception as e:
            print(f"{_get_now()} ❌ Failed to log warning: {e}")

    @staticmethod
    @XSentry.wrap_span("XErrorLogger.LogNotice")
    def LogNotice(Msg):
        """Logs notable events and sends breadcrumb to Sentry."""
        try:
            filename, lineno, func_name = _caller_location()
            print(f"{_get_now()} 📢 [NOTICE] {Msg} (📂 File: {filename} | 📌 Line: {lineno} | 🏷️ Function: {func_name})")
            XSentry.add_breadcrumb(message=Msg, category="notice", level="info")
        except Exception as e:
            print(f"{_get_now()} ❌ Failed to log notice: {e}")

    @staticmethod
    @XSentry.wrap_span("XErrorLogger.LogDebug")
    def LogDebug(Msg):
        """Logs debugging messages with file and line number."""
        try:
            filename, lineno, func_name = _caller_location()
            print(f"{_get_now()} 🛠️ [DEBUG] {Msg} (📂 File: {filename} | 📌 Line: {lineno} | 🏷️ Function: {func_name})")
        except Exception as e:
            print(f"{_get_now()} ❌ Failed to log debug info: {e}")

    @staticmethod
    @XSentry.wrap_span("XErrorLogger.LogInfo")
    def LogInfo(Msg):
        """Logs general info messages."""
        try:
            print(f"{_get_now()} ℹ️ [INFO] {Msg}")
        except Exception as e:
            print(f"{_get_now()} ❌ Failed to log info: {e}")


def LogError(Exc=None, Msg='❌ Error', Tags=None, Fingerprint=None):
    XErrorLogger.LogError(Exc, Msg, Tags, Fingerprint)


def LogWarning(Msg):
    XErrorLogger.LogWarning(Msg)


def LogNotice(Msg):
    XErrorLogger.LogNotice(Msg)


def LogDebug(Msg):
    XErrorLogger.LogDebug(Msg)


def LogInfo(Msg):
    XErrorLogger.LogInfo(Msg)
