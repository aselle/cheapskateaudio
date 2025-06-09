#!/usr/bin/env python3
"""Flashes json dsp files to cheap skate dsp. Uses mDNS to find servers."""
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
import requests
import os
import sys
import time
import socket
import typing
from zeroconf import Zeroconf, ServiceStateChange, ServiceBrowser

servers = {}

def on_service_state_change(
    zeroconf: Zeroconf, service_type: str, name: str, state_change: ServiceStateChange
) -> None:
    # print("Service %s of type %s state changed: %s" % (name, service_type, state_change))

    if state_change is ServiceStateChange.Added:
        info = zeroconf.get_service_info(service_type, name)
        if info:
            addresses = ["%s:%d" % (socket.inet_ntoa(addr), typing.cast(int, info.port)) for addr in info.addresses]
            print("  Addresses: %s" % ", ".join(addresses))
            print("  Weight: %d, priority: %d" % (info.weight, info.priority))
            print("  Server: %s" % (info.server,))
            servers[info.server] = addresses[0]
            if info.properties:
                print("  Properties are:")
                for key, value in info.properties.items():
                    print("    %s: %s" % (key, value))
            else:
                print("  No properties")
        else:
            print("  No info")
        print('\n')

if True:
    if len (sys.argv) != 2:
        print ("Usage: %s <json>"%(sys.argv[0],))
        sys.exit(1)
    

    zeroconf = Zeroconf()
    browser = ServiceBrowser(zeroconf, "_adau1701._tcp.local.", handlers=[on_service_state_change])
    time.sleep(5)
    items = []
    print(servers.items())
    for idx, i in enumerate(servers.items()):
        print ("%d) %r" % (idx, i))
        items.append(i)
    print("Type # of board you wish to update boot.json on.")
    foo = sys.stdin.readline()
    choice = int(foo)
    ip = items[choice][1]
    if True:
        files = {'upload_file': open(sys.argv[1],'rb')}
        values = {}
        post_url = "http://%s/upload" % ip.split(":")[0]
        print(post_url)
        r = requests.post(post_url, files=files, data=values)
        url = "http://%s/boot.json" % ip.split(":")[0]
        print(url)
        r = requests.get(url)
        print(r)
        
