#!/usr/bin/env python3
"""Relays to a DSP server, so we can swap which server we are talking about.

Basically works around the ability to not change IP very easily in sigma
studio. Work in progresss.
"""

# Copyright Andrew Selle 

# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at

# http://www.apache.org/licenses/LICENSE-2.0

# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
import time
import struct
import socket
import sys
import threading
from contextlib import contextmanager


HOST='0.0.0.0'
PORT=int(sys.argv[1])

@contextmanager
def socketcontext(*args, **kw):
    s = socket.socket(*args, **kw)
    try:
        yield s
    finally:
        s.close()

@contextmanager
def ConnManager(conn):
    s = conn
    try:
        yield s
    finally:
        s.close()


#READ_CODE=0x09
#state = "IDLE"
#toproc = bytes()
#def process(data):
#    global toproc
#    toproc += data
#    if state == "IDLE":
#        if toproc[0] == READ_CODE:
#            
class DSP:
    def __init__(self):
        self.sock=socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        #self.sock.connect(("192.168.1.126", 23))
        self.sock.connect(("10.0.0.139", 23))

        self.data_to_send = []
        t = threading.Thread(target=self.recv_loop, args=tuple())
        t.start()

        self.sock.send(b"read 0x400 256\n")
        time.sleep(2)
        
        
    def send_to_dsp(self, safe, addr, size, data):
        cmd = "write %d 0x%x %d\n" % (safe, addr, size)
        print(cmd)
        while data:
            cmd += "".join(["%02X"%x for x in data[:16]])
            cmd += "\n"
            data = data[16:]
        self.sock.send(cmd.encode("utf-8"))
        if safe:
            print(cmd)
            #print (cmd)

    def recv_loop(self):
        data = bytes()
        while 1:
            data += self.sock.recv(1024)
            items = data.split(b"\n")
            #for i in items[:-1]:
            #    print("sock: " + i.decode('UTF-8'))
            data = items[-1]
            
dsp =  None # DSP()

ADAU1466="ADAU1466"
ADAU1452="ADAU1452"
mode = ADAU1452

format_hex = lambda bs: "".join("0x%02x " % b for b in bs)
        
with socketcontext(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.bind((HOST, PORT))
    s.listen(1)
    conn, addr = s.accept()
    with ConnManager(conn):
        print('Connected by ', addr)
        while True:
            code = conn.recv(1)
            if code[0] == 0x09:
                if mode == ADAU1452:
                    header = conn.recv(13)
                    safe, channel, packet_size, chip_addr, data_size, addr = struct.unpack("!BBIBIH", header)
                    print ("ADAU1452 Write Size %08x bytes chip %02x data size %04x  addr %04x"%(packet_size, chip_addr, data_size, addr))
                    bytes_needed = data_size
                    data = bytes()
                    while bytes_needed > 0:
                        data += conn.recv(bytes_needed)
                        bytes_needed -= len(data)
                    
                    print("Send addr=0x%x size=%d data=%s" % (addr, data_size, format_hex(data)))    
                else:
                    header = conn.recv(9)
                    for item in header:
                        print (" 0x%02x"%item, end=''),
                    print(" ")
                    safe, channel, packet_size, chip_addr, data_size, addr = struct.unpack(
                        "!BBHBHH", header)
                    print ("Write Size %08x bytes chip %02x data size %04x  addr %04x"%(packet_size, chip_addr, data_size, addr))
                    bytes_needed = data_size
                    data = bytes()
                    while bytes_needed > 0:
                        data += conn.recv(bytes_needed)
                        bytes_needed -= len(data)
                    print("Send addr=0x%x size=%d data=" % (addr, data_size, format_hex(data)))    
                if dsp: dsp.send_to_dsp(safe, addr, data_size, data)
            elif code[0] == 0x0a:
                # TTODO fix this
                print (len(code))
                _, packet_size, chip_addr, data_size, addr = struct.unpack(
                    "!BIBHH", code)
                print ("Read Size %08x bytes chip %02x data size %04x  addr %04x"%(packet_size, chip_addr, data_size, addr))
            else:
                print ("Only support 0x09,0x0A got 0x%x" % code[0])
                
            #print (type(data))
            if not data:
                break
            #for item in data:
            #    print (" 0x%02x"%item, end=''),
            #process(data)   
            #sys.stdout.flush()
            #conn.sendall(data)
            
