<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
// Force UTC to avoid server timezone misconfiguration
date_default_timezone_set('UTC');

$dir = __DIR__;
$result = ['immediate' => [], 'batches' => []];

$imPath = $dir . '/events_immediate.log';
$batchPath = $dir . '/events_batch.log';

if (file_exists($imPath)) {
    $lines = file($imPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $j = json_decode($line, true);
        if ($j) $result['immediate'][] = $j;
    }
}

if (file_exists($batchPath)) {
    $lines = file($batchPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $j = json_decode($line, true);
        if ($j) $result['batches'][] = $j;
    }
}

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

?>
