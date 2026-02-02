#!/bin/bash
# Test script to check API response
echo "Waiting for page to be loaded by user..."
sleep 10
echo "Checking recent logs..."
tail -100 /Users/fabrice.demange/1coopaz/coopazv13/logs/combined1.log | grep -A 10 "DEBUG"
