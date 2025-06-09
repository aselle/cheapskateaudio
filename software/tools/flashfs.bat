C:\Users\asell\AppData\Local\Arduino15\packages\esp8266\tools\mkspiffs\3.1.0-gcc10.3-e5f9fec\mkspiffs.exe -c c:\users\asell\Documents\code\cheapaudio\software\cheapaudioserver\cheapaudio_firmware\data -p 256 -b 8192 -s 1048576 out.spiffs

REM set PYTHONPATH=C:\Users\asell\AppData\Local\Arduino15\packages\esp8266\hardware\esp8266\3.1.2\tools

REM C:\Users\asell\AppData\Local\Arduino15\packages\esp8266\tools\python3\3.7.2-post1\python c:\Users\asell\AppData\Local\Arduino15\packages\esp8266\hardware\esp8266\3.1.2\tools\esptool\esptool.py

python -m esptool --port COM6 write_flash 0x200000 out.spiffs