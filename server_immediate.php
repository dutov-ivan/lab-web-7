<?php
header('Content-Type: application/json; charset=utf-8');
// Force UTC to avoid server timezone misconfiguration
date_default_timezone_set('UTC');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'error' => 'invalid_json']);
    exit;
}

// Use microtime to record arrival time with microsecond precision
$micro = microtime(true);
$dt = DateTime::createFromFormat('U.u', sprintf('%.3F', $micro));
if ($dt === false) {
    // fallback to second precision ISO8601 UTC
    $server_time = gmdate('c');
} else {
    $dt->setTimezone(new DateTimeZone('UTC'));
    // format like 2025-12-11T12:34:56.123456Z
    $server_time = $dt->format("Y-m-d\\TH:i:s.u\\Z");
}

$entry = [
    'received_at' => $server_time,
    'client_sent_time' => isset($data['time_local']) ? $data['time_local'] : null,
    'event_id' => isset($data['id']) ? $data['id'] : null,
    'message' => isset($data['message']) ? $data['message'] : null,
    'type' => isset($data['type']) ? $data['type'] : null,
    'payload' => $data,
];

$logLine = json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
file_put_contents(__DIR__ . '/events_immediate.log', $logLine, FILE_APPEND | LOCK_EX);

echo json_encode(['status' => 'ok', 'server_time' => $server_time]);
