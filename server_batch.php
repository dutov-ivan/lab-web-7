<?php
header('Content-Type: application/json; charset=utf-8');
// Force UTC to avoid server timezone misconfiguration
date_default_timezone_set('UTC');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data || !isset($data['events']) || !is_array($data['events'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'error' => 'invalid_json_or_missing_events']);
    exit;
}

// Use microtime to record arrival time with microsecond precision
$micro = microtime(true);
$dt = DateTime::createFromFormat('U.u', sprintf('%.6F', $micro));
if ($dt === false) {
    $server_time = gmdate('c');
} else {
    $dt->setTimezone(new DateTimeZone('UTC'));
    $server_time = $dt->format("Y-m-d\\TH:i:s.u\\Z");
}

$batchEntry = [
    'received_at' => $server_time,
    'count' => count($data['events']),
    'events' => $data['events'],
];

$logLine = json_encode($batchEntry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
// Store only the latest batch (overwrite instead of append)
file_put_contents(__DIR__ . '/events_batch.log', $logLine, LOCK_EX);

echo json_encode(['status' => 'ok', 'server_time' => $server_time]);
