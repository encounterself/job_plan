#!/usr/bin/env python3
"""Safe WeCom notification helpers with a local mock self-test.

Real sends are opt-in. Run ``python wecom_notifier.py --self-test`` to test
payload construction and HTTP handling against a local mock server.
"""

from __future__ import annotations

import argparse
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def build_markdown(message: str) -> dict[str, Any]:
    return {"msgtype": "markdown", "markdown": {"content": message}}


def build_app_message(agent_id: int, user_ids: list[str], message: str) -> dict[str, Any]:
    return {
        "touser": "|".join(user_ids),
        "msgtype": "markdown",
        "agentid": agent_id,
        "markdown": {"content": message},
        "enable_duplicate_check": 1,
        "duplicate_check_interval": 1800,
    }


def post_json(url: str, payload: dict[str, Any], timeout: float = 10.0) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urlopen(request, timeout=timeout) as response:
        result = json.loads(response.read().decode("utf-8"))
    if result.get("errcode", 0) != 0:
        raise RuntimeError(f"WeCom API error: {result}")
    return result


def get_access_token(corp_id: str, corp_secret: str, base_url: str = "https://qyapi.weixin.qq.com") -> str:
    query = urlencode({"corpid": corp_id, "corpsecret": corp_secret})
    request = Request(f"{base_url}/cgi-bin/gettoken?{query}", method="GET")
    with urlopen(request, timeout=10.0) as response:
        result = json.loads(response.read().decode("utf-8"))
    if result.get("errcode", 0) != 0:
        raise RuntimeError(f"WeCom token error: {result}")
    return result["access_token"]


def send_webhook(webhook_url: str, message: str) -> dict[str, Any]:
    return post_json(webhook_url, build_markdown(message))


def send_app_message(
    access_token: str,
    agent_id: int,
    user_ids: list[str],
    message: str,
    base_url: str = "https://qyapi.weixin.qq.com",
) -> dict[str, Any]:
    return post_json(
        f"{base_url}/cgi-bin/message/send?access_token={access_token}",
        build_app_message(agent_id, user_ids, message),
    )


class MockHandler(BaseHTTPRequestHandler):
    received: list[dict[str, Any]] = []

    def do_POST(self) -> None:  # noqa: N802 - stdlib handler API
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        self.received.append({"path": self.path, "payload": payload})
        response = json.dumps({"errcode": 0, "errmsg": "ok", "msgid": "mock-message-id"}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    def log_message(self, *_: Any) -> None:
        return


def self_test() -> None:
    MockHandler.received = []
    server = ThreadingHTTPServer(("127.0.0.1", 0), MockHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_port}"
    message = "## Databricks 开发资产提醒\n> Job `demo_job` 超过 5 天未迁移生产。"
    try:
        webhook_result = send_webhook(f"{base_url}/cgi-bin/webhook/send?key=mock", message)
        app_result = send_app_message("mock-token", 100001, ["test-user"], message, base_url=base_url)
        assert webhook_result["errcode"] == 0
        assert app_result["errcode"] == 0
        assert len(MockHandler.received) == 2
        assert MockHandler.received[0]["payload"]["msgtype"] == "markdown"
        assert MockHandler.received[1]["payload"]["agentid"] == 100001
        assert MockHandler.received[1]["payload"]["touser"] == "test-user"
        print("self-test: PASS (webhook + app payload + HTTP response)")
    finally:
        server.shutdown()
        server.server_close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true", help="run local mock test; never calls WeCom")
    args = parser.parse_args()
    if args.self_test:
        self_test()
    else:
        parser.error("No action selected. Use --self-test; real sends require explicit integration code and secrets.")


if __name__ == "__main__":
    main()
