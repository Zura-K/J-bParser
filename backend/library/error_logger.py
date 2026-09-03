import inspect
import os
import traceback

from library import sentry as sentry_module
from library.sentry import XSentry

_internal_files = {
    os.path.abspath(__file__),
    os.path.abspath(sentry_module.__file__),
}


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
    @XSentry.wrap_span("XErrorLogger.Log")
    def Log(
        Msg,
        Severity,
        ExtraData=None,
        HelpLink=None,
        Exc=None,
        Tags=None,
        Fingerprint=None,
        IncludeLocation=True,
    ):
        """Reports a message or exception to Sentry with location and extra context."""
        try:
            extra = dict(ExtraData or {})
            if HelpLink is not None:
                extra["help_link"] = HelpLink
            if Exc is not None:
                tb = traceback.extract_tb(Exc.__traceback__)
                if tb:
                    extra.setdefault("file", tb[-1].filename)
                    extra.setdefault("line", tb[-1].lineno)
                    extra.setdefault("function", getattr(tb[-1], "name", "Unknown"))
                XSentry.capture_exception(
                    Exc, tags=Tags, fingerprint=Fingerprint, extras=extra
                )
                return
            if IncludeLocation:
                filename, lineno, func_name = _caller_location()
                extra.setdefault("file", filename)
                extra.setdefault("line", lineno)
                extra.setdefault("function", func_name)
            XSentry.capture_message(
                Msg, Severity, tags=Tags, fingerprint=Fingerprint, extras=extra
            )
        except Exception:
            pass

    @staticmethod
    def LogError(Exc=None, Msg='❌ Error', ExtraData=None, HelpLink=None, Tags=None, Fingerprint=None):
        XErrorLogger.Log(Msg, 'error', ExtraData, HelpLink, Exc, Tags, Fingerprint)

    @staticmethod
    def LogWarning(Msg, ExtraData=None, HelpLink=None):
        XErrorLogger.Log(Msg, 'warning', ExtraData, HelpLink)

    @staticmethod
    def LogNotice(Msg, ExtraData=None, HelpLink=None):
        XErrorLogger.Log(Msg, 'log', ExtraData, HelpLink)

    @staticmethod
    def LogDebug(Msg, ExtraData=None, HelpLink=None):
        XErrorLogger.Log(Msg, 'debug', ExtraData, HelpLink)

    @staticmethod
    def LogInfo(Msg, ExtraData=None, HelpLink=None):
        XErrorLogger.Log(Msg, 'info', ExtraData, HelpLink, IncludeLocation=False)


def LogError(Exc=None, Msg='❌ Error', ExtraData=None, HelpLink=None, Tags=None, Fingerprint=None):
    XErrorLogger.LogError(Exc, Msg, ExtraData, HelpLink, Tags, Fingerprint)


def LogWarning(Msg, ExtraData=None, HelpLink=None):
    XErrorLogger.LogWarning(Msg, ExtraData, HelpLink)


def LogNotice(Msg, ExtraData=None, HelpLink=None):
    XErrorLogger.LogNotice(Msg, ExtraData, HelpLink)


def LogDebug(Msg, ExtraData=None, HelpLink=None):
    XErrorLogger.LogDebug(Msg, ExtraData, HelpLink)


def LogInfo(Msg, ExtraData=None, HelpLink=None):
    XErrorLogger.LogInfo(Msg, ExtraData, HelpLink)
