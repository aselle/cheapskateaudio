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
import os
import sys
import shutil
PACK_DIR = "fspack"
rootDir = "build"

if os.path.exists(PACK_DIR):
  shutil.rmtree(PACK_DIR)
os.mkdir(PACK_DIR)


with open(os.path.join(PACK_DIR, "index.txt"),"w") as index_fp:
    idx = 0
    for dir, subdirs, files in os.walk(rootDir):
        for i in files:
            ext = os.path.splitext(i)[1]
            fullpath = os.path.join(dir,i)
            serve_path = fullpath.replace(rootDir, "")
            shutil.copy(fullpath, os.path.join(PACK_DIR, str(idx)))
            index_fp.write("%d %s\n" % (idx, serve_path) )
            idx += 1    
