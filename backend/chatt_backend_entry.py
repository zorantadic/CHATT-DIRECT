from multiprocessing import freeze_support

import uvicorn

from app_realtime import PORT, app


def main() -> None:
    freeze_support()
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="info")


if __name__ == "__main__":
    main()
