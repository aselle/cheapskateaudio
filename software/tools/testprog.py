# Copyright Andrew Selle 
# 
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
# http://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import time 
import os
import sys
import json
import socket

import socket
from asyncio import IncompleteReadError  # only import the exception class


class SocketStreamReader:
    def __init__(self, sock: socket.socket):
        self._sock = sock
        self._recv_buffer = bytearray()

    def read(self, num_bytes: int = -1) -> bytes:
        raise NotImplementedError

    def readexactly(self, num_bytes: int) -> bytes:
        buf = bytearray(num_bytes)
        pos = 0
        while pos < num_bytes:
            n = self._recv_into(memoryview(buf)[pos:])
            if n == 0:
                raise IncompleteReadError(bytes(buf[:pos]), num_bytes)
            pos += n
        return bytes(buf)

    def readline(self) -> bytes:
        return self.readuntil(b"\n")

    def readuntil(self, separator: bytes = b"\n") -> bytes:
        if len(separator) != 1:
            raise ValueError("Only separators of length 1 are supported.")

        chunk = bytearray(4096)
        start = 0
        buf = bytearray(len(self._recv_buffer))
        bytes_read = self._recv_into(memoryview(buf))
        assert bytes_read == len(buf)

        while True:
            idx = buf.find(separator, start)
            if idx != -1:
                break

            start = len(self._recv_buffer)
            bytes_read = self._recv_into(memoryview(chunk))
            buf += memoryview(chunk)[:bytes_read]

        result = bytes(buf[: idx + 1])
        self._recv_buffer = b"".join(
            (memoryview(buf)[idx + 1 :], self._recv_buffer)
        )
        return result

    def _recv_into(self, view: memoryview) -> int:
        bytes_read = min(len(view), len(self._recv_buffer))
        view[:bytes_read] = self._recv_buffer[:bytes_read]
        self._recv_buffer = self._recv_buffer[bytes_read:]
        if bytes_read == len(view):
            return bytes_read
        bytes_read += self._sock.recv_into(view[bytes_read:])
        return bytes_read


foo =json.load(open("adau1452.json"))
progs = foo["ics"][0]["progs"]

sock = socket.socket()
sock.connect(("10.0.0.139", 23))
#sock.send(b"read 0x00 2\n")
sock.settimeout(2)


reader = SocketStreamReader(sock)


#a=sock.recv(64)
#print(a)
#sock.close()
live = True

for i in progs:
    addr = i["0Address"]
    byte_count = i["0Size"]
    data = i["Data"]
    data_to_send = "".join(data)
    #print(data)
    #data = i["Data"][:16]
    #if len(i["Data"]) > len(data):
    #    data.append("...")

    if "Delay" in i["Name"]:
        print("Delaying...")
        time.sleep(1.)
        continue
        
    if live:
        # print("0x%04x (%d byte_count) %r" % (addr, byte_count, data_to_send))
        data_to_send = data_to_send.upper()

        cmd = "write 0 0x%04x %d\n%s\n" % (addr, byte_count, data_to_send)
        print("--- ", cmd, "(", i["Name"], ")")
        sock.send(cmd.encode())
        line = reader.readline()
        #print(line)
        #print("Read back")
        cmd2 = "read 0x%04x %d\n"%(addr, byte_count)
        #print(">", cmd2)
        readback = b""
        sock.send(cmd2.encode())
        bytes_read  = 0
        while 1:
            line = reader.readline()
            bytes_read += (len(line)-1)//2
            print("<", line)
            #print(bytes_read, byte_count)
            if bytes_read == byte_count:
                break


        time.sleep(.25)
    else:
        print("%s write 0x%04x %d" % (i["Name"], addr, byte_count))
