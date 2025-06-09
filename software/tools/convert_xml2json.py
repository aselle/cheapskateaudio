#!/usr/bin/env python3
"""Converts from Sigma Studio XML files to a JSON equivalent for cheap dsp"""

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

import json
import os
import sys
import xml.etree.ElementTree as ElementTree


def parseNumbers(x):
    try:
        return int(x)
    except:
        pass
    try:
        return float(x)
    except:
        pass
    return x


def convertHelper(curr, depth):
    print(curr.tag)
    if curr.keys(): print(curr.keys())
    assert not curr.keys()

    # No children so just return text
    if len(curr) == 0: 
        return parseNumbers(curr.text)
    if depth > 4: 
        assert False
        return  # needed?

    result = {}

    # Tags that exist in lists that need to be further bucketed
    # i.e. <IC>ic1</IC><IC>ic2</IC> --> {"ics": [ic1,ic2]}
    BUCKETS = {"IC": "ics", "Module": "modules", "Register": "progs", 
               "Program": "progs", "Algorithm": "algorithms",
               "ModuleParameter": "params"}

    for child in curr:
        bucket = BUCKETS[child.tag] if child.tag in BUCKETS else None
        compacted = convertHelper(child, depth + 1)
        if child.tag == "Size": child.tag = "0Size"
        if child.tag == "Address": child.tag = "0Address"
        #if child.tag == "Name": child.tag = "0Name"

        if child.tag == "Data":
            items = ["%02x" % int(x, 16) for x in compacted.split(",") if x.strip() != '']
            compacted = []
            blocking = 1
            for k in range(0, len(items), blocking):
                compacted.append("".join(items[k:k+blocking]))
                # break # TODO THIS IS NOT RIGHT

        if bucket:
            if bucket not in result:
                result[bucket] = []
            result[bucket].append(compacted)
        else:
            result[child.tag] = compacted

    return result


def convert(inputFile, outputFile):
    tree = ElementTree.parse(inputFile)
    root = tree.getroot()
    d = convertHelper(root, 0)
    with open(outputFile, 'w') as fp:
        json.dump(d, fp, sort_keys=True, ensure_ascii=True) #, indent=2)


if __name__=='__main__':
    try:
        inputFile, outputFile = sys.argv[1:]
    except:
        print("Usage: %s <in file xml> <out file json>" % (sys.argv[0],))
    convert(inputFile, outputFile)
