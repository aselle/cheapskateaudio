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
import sys
import json
import functools

cleaned = {"ics": []} #

def get_vals(blocks, blockname, addr, size):
    for block in blocks:
        if block["Name"] == blockname:
            base = block["0Address"]
            byteoffset = (addr - base)*block["AddrIncr"]
            return block["Data"][byteoffset:byteoffset+size]
    raise ValueError(f"Didn't find block {block}" )

def in_range(block, addr,size):
    if block["AddrIncr"] == 0: return False
    blockstart = block["0Address"]
    blockend = blockstart + block["0Size"] // block["AddrIncr"]
    addrend = addr + size // block["AddrIncr"]
    return addr > blockstart and  addrend < blockend

def find_range(blocks, addr, size):
    for block in blocks:
        if in_range(block, addr, size):
            return block["Name"]
    raise ValueError("Failed to find block")

def do(fname):
    j = json.load(open(fname))
    for ic in j["ics"]:
        do_ic(ic)

def do_ic(ic):
    progs = ic["progs"]
        
    cleaned_ic = {"Name": ic["Name"], "clean_params": [], "modules": [], "progs": []}
    for prog in progs:
        #print("0x%04x, %8d bytes, %s"%(prog["0Address"], prog["0Size"], prog["Name"]))
        cleaned_ic["progs"].append({
            "Name": prog["Name"],
            "0Address": prog["0Address"],
            "0Size": prog["0Size"],
            "Data": prog["Data"],
            "AddrIncr": prog["AddrIncr"]
        })

    biquad_seqs = ["B2","B1","B0","A2","A1"]
    for module in ic["modules"]:
        is_biquad = "Xover" in module["CellName"]  or "PEQ" in module["CellName"]
        print(module["CellName"], "(biquad based)" if is_biquad else "")
        seq = 0
        assert (len(module['algorithms']) == 1)
        for alg in module["algorithms"]:
        
            print("  ", alg["DetailedName"])
            lastaddr = None
            minaddr = 1<<31

            total_size = 0

            for param in alg["params"]:
                short = param["Name"].replace(alg["DetailedName"], "")
                #print(short)
                #if biquad_seqs[seq] in biquad_seqs
                addr = param["0Address"]
                size = param["0Size"]
                block = find_range(progs, addr, param["0Size"])
                # print("BLOCK IS ", type(block))
                vals = get_vals(progs, block, addr, size)
                same = [x==y for x,y in zip(param["Data"], vals)]
                if is_biquad:
                    all_same = functools.reduce(lambda x,y: x and y, same)
                    assert all_same
                    # Check addresses are contiguous
                    if lastaddr is not None and addr != lastaddr + 1:
                        raise ValueError(f"Assuming monotonic addresses had old {lastaddr} and {addr} on {param['Name']}")
                    # Check that order is B2, B1, B0, A2, A1
                    if biquad_seqs[seq] not in short:
                        raise ValueError(f"Expected {biquad_seqs[seq]} to be in name of {short}")

                    seq = (seq +1 )% 5
                lastaddr = addr
                minaddr = min(addr, minaddr)
                total_size += size
                #print("    %s (%s) %r" %(short, block, vals))



            if is_biquad:
                print("TESTO", biquad_seqs[seq], short)
                num_biquads = len(alg['params'])//5
                #print(f"   0x{minaddr:04x} {num_biquads=} {total_size=}")
                
                cleaned_ic["clean_params"].append({
                    "Name": module["CellName"],
                    "Address": minaddr,
                    "Size": total_size,
                    "Biquads": num_biquads,
                    "Block": block,
                })

    cleaned["ics"].append(cleaned_ic)
fname = sys.argv[1]
do(fname)

with open("hacked.json", "w") as fp:
    json.dump(cleaned, fp, indent=4)