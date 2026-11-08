#!/bin/bash

read -p "Enter (IP:PORT) => " IP_PORT

# Connect to the device via ADB over Wi-Fi
echo "Connecting to device ${IP_PORT}..."
adb connect "${IP_PORT}"

echo "Setting maximum process limit..."
adb shell "device_config set_sync_disabled_for_tests persistent"
adb shell "device_config put activity_manager max_phantom_processes 2147483647"

# Verify the current value
CURRENT_VAL=$(adb shell "device_config get activity_manager max_phantom_processes")
echo "Current max_phantom_processes value: ${CURRENT_VAL}"

echo "Removing background restrictions for Termux..."

# Exclude Termux from battery / Doze optimizations
adb shell "dumpsys deviceidle whitelist +com.termux"

# Allow Termux to run background processes
adb shell "cmd appops set com.termux RUN_IN_BACKGROUND allow"

# Allow Termux to acquire wakelocks
adb shell "cmd appops set com.termux WAKE_LOCK allow"

# Prevent Termux from going into idle state
adb shell "am set-inactive com.termux false"

echo "All background restrictions for Termux have been removed successfully."
