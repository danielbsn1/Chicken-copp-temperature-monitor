#pragma once

// Pinos
#define PIN_DHT22 4
#define PIN_RELAY 26

// Nível que ativa o módulo de relé (HIGH ou LOW, conforme o módulo)
#define RELAY_ACTIVE_LEVEL HIGH

// Limiares (°C)
#define TEMP_FAN_ON 30.0f
#define TEMP_FAN_OFF 28.0f
#define TEMP_CRITICAL 35.0f
#define TEMP_VALID_MIN -10.0f
#define TEMP_VALID_MAX 60.0f

// Intervalos (ms)
#define SENSOR_READ_INTERVAL_MS 2000UL
#define SAMPLE_INTERVAL_MS 60000UL
#define RELAY_MIN_STATE_MS 60000UL

// Sensor
#define SENSOR_FAIL_LIMIT 3

// Rede
#define SAMPLE_BUFFER_SIZE 360
#define BATCH_MAX_SAMPLES 50
