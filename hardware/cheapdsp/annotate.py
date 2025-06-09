import skidl
import traceback

from skidl import Net, Part, Circuit, subcircuit


fp_trace = open("trace.txt","w")
refs = {}
OldPart = Part
def Part(*args, **kwargs):
	global refs
	ret = OldPart(*args, **kwargs)
	for i in traceback.extract_stack():
		#print(i)
		fname, line, funcname, frame = i
		#print(fname, fname.find(u"t.py"))
		if fname.find("tas5754m.py") != -1:
			if line not in refs:
				refs[line] = []
			refs[line].append(ret.ref)
			#print(refs[line])
	fp_trace.write(ret.ref +"\n\n")
	fp_trace.write("".join(traceback.format_stack()))
	return ret



def annotate(fname, outfile):
	lines = open(fname).readlines()
	out = open("dsp_annotate.txt","w")
	for lineno0,line in enumerate(lines):
		lineno = lineno0 + 1
		syms=""
		if lineno in refs:
			stuff = refs[lineno]
			if len(stuff) < 10:
				syms=" ".join(stuff)
			else:
				syms = "<LOTS>"
		out.write( "%30s|%s"%(syms, line))
	out.close()