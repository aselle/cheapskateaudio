import skidl
from skidl import Net, Part, Circuit, subcircuit
import traceback
import json

import annotate 
Part = annotate.Part

SMT0805 = "Capacitor_SMD:C_0805_2012Metric_Pad1.15x1.40mm_HandSolder"
POWER_CONNECTOR = "cheapskate_amp_footprints:KF301-5.0-2P"
SPEAKER_CONNECTOR = "cheapskate_amp_footprints:DINKLE-EK508V-04P"
METALIZED_CAP = "cheapskate_amp_footprints:CAP_PE105J2A0501"
SMTELECTRO = "Capacitor_SMD:CP_Elec_6.3x5.4"
INDUCTOR = "cheapskate_amp_footprints:inductor_ms1350"
CAP_TH = "Capacitor_THT:CP_Radial_D5.0mm_P2.50mm"


class CheapSkateTAS5754M:
	def __init__(self, circuit=None):
		self.breakouts = {}
		print("HI")
		self.circuit = Circuit() if circuit is None else circuit
		self.circuit.mini_reset()
		print(self)
		self.build(circuit=self.circuit)	



	def get_amp_net(self,x):
		if x not in self.breakouts: 
			self.breakouts[x] = Net(x)
			self.breakouts[x] += self.amp[x]
		return self.breakouts[x]

	@subcircuit
	def build(self):
		self.amp = Part("tas5754m_symbol","TAS5754M", footprint="cheapskate_amp_footprints:TSSOP48-TAS5574M")

		self.gnd = Net("GND")
		self.gnd.drive = skidl.POWER

		self.v33 = Net("V33")
		self.pvdd = Net("PVDD")

		self.circuit += self.gnd
		
		self.amp["PAD"] += self.gnd

		def amp_output_structure(spk, bst, cspk_to_bst, lref, ref_cdecouple):
			l = Part("Device","L", value="10uH", ref=lref, footprint=INDUCTOR)
			assert spk.startswith("SPK_")
			self.amp[spk] += Net(spk)
			self.amp[bst] += Net(bst)
			output_net = Net(spk.replace("SPK_",""))
			self.amp[spk] += l[1]
			self.decouple(l[2], ["1uF"], ref=ref_cdecouple, footprint=METALIZED_CAP)
			c = Part("Device", "C", value="0.22uF", ref=cspk_to_bst, footprint=SMT0805)
			self.amp[spk] += c[1]
			c[2] += self.amp[bst]
			self.amp[bst].drive = skidl.POWER

			output_net += l[2]
			return output_net

		SPK_OUTAP = amp_output_structure("SPK_OUTA+", "BSTRPA+", "C104", "L100", "C109")
		SPK_OUTAM = amp_output_structure("SPK_OUTA-", "BSTRPA-", "C108", "L101", "C110")
		SPK_OUTBP = amp_output_structure("SPK_OUTB+", "BSTRPB+", "C115", "L103", "C117")
		SPK_OUTBM = amp_output_structure("SPK_OUTB-", "BSTRPB-", "C111", "L102", "C116")

		self.decouple(self.get_amp_net("DVDD_REG"), ["1uF"], ref="C118", footprint=SMT0805)
		self.decouple(self.amp["DVDD"], ["1uF"], ref="C119", footprint=SMT0805)
		self.amp["CPVSS"].drive = skidl.POWER
		self.decouple(self.get_amp_net("CPVSS"), ["1uF"], ref="C120", footprint=SMT0805)

		# PVDD and decoupling		
		self.amp["PVDD"] += self.pvdd
		self.decouple(self.amp["PVDD"], ["0.1uF"], ref="C121", footprint=SMT0805)
		self.decouple(self.amp["PVDD"], ["22uF"], ref="C122", footprint=SMTELECTRO, polarized=True)
		self.decouple(self.amp["PVDD"], ["22uF"], ref="C123", footprint=SMTELECTRO, polarized=True)
		self.decouple(self.amp["PVDD"], ["0.1uF"], ref="C100", footprint=SMT0805)
		self.decouple(self.amp["PVDD"], ["22uF"], ref="C101", footprint=SMTELECTRO, polarized=True)
		self.decouple(self.amp["PVDD"], ["22uF"], ref="C102", footprint=SMTELECTRO, polarized=True)

		# CP to CN
		def SimpleC(a, b, ref, val, footprint):
			c = Part("Device", "C", value=val, ref=ref, footprint=footprint)
			a += c[1]
			b += c[2]
		SimpleC(self.get_amp_net("CP"), self.get_amp_net("CN"), "C112", "1uF", footprint=SMT0805)
		self.amp["CP"].drive = skidl.POWER  # label it as power net
		self.amp["CN"].drive = skidl.POWER  # label it as power net



		SimpleC(self.get_amp_net("DAC_OUTB"), self.get_amp_net("SPK_INB+"), "C113", "2.2uF", footprint=SMT0805)
		SimpleC(self.get_amp_net("DAC_OUTA"), self.get_amp_net("SPK_INA+"), "C106", "2.2uF", footprint=SMT0805)
		self.decouple(self.get_amp_net("SPK_INB-"), ["2.2uF"], ref="C114",  footprint=SMT0805)
		self.decouple(self.get_amp_net("SPK_INA-"), ["2.2uF"], ref="C107", footprint=SMT0805)

		# Test pads for dac outputs
		def test_pad(x, ref):
			pad = Part("Connector", "TestPoint", footprint="TestPoint_Pad_D1.0mm", ref=ref)
			pad[1] += x
			return pad
		test_pad(self.get_amp_net("DAC_OUTB"), ref="J100")
		test_pad(self.get_amp_net("DAC_OUTA"), ref="J101")

		# Set switching frequency
		r100 = Part("Device","R", ref="R100", value="750k", footprint=SMT0805)
		r101 = Part("Device","R", ref="R101", value="150k", footprint=SMT0805)
		r100[1] += self.gnd
		r100[2] += self.get_amp_net("SPK_GAIN/FREQ")
		r100[2] += r101[1]
		r101[2] += self.get_amp_net("GVDO")
		# Filter the GVDD
		self.decouple(self.amp["GVDO"], ["1uF"], ref="C103",  footprint=SMT0805)

		# Power AVDD
		self.amp["AVDD"] += self.v33
		self.decouple(self.amp["AVDD"], ["1uF"], ref="C105",  footprint=SMT0805)

		self.amp["DVDD"] += self.v33
		self.amp["CPVDD"] += self.v33
		# Grounds
		self.amp["AGND"] += self.gnd
		self.amp["DGND"] += self.gnd
		self.amp["GND"] += self.gnd
		self.amp["PGND"] += self.gnd

		# TODO: should WP be broken out like this?
		self.addr0 = Net("ADDR0")
		self.addr1 = Net("ADDR1")
		hdr = Part("Connector_Generic", "Conn_02x03_Odd_Even", footprint="Connector_PinHeader_2.54mm:PinHeader_2x03_P2.54mm_Vertical")
		hdr[1] += self.v33
		hdr[3] += self.addr0
		hdr[5] += self.gnd
		hdr[2] += self.v33
		hdr[4] += self.addr1
		hdr[6] += self.gnd
		self.amp["ADR0"] += self.addr0
		self.amp["ADR1"] += self.addr1

		

		def breakout(hdr, pin, part, name):
			net = Net(name)
			hdr[pin] += net
			part[name] += net
			return net

		hdr = Part("Connector_Generic", "Conn_02x11_Odd_Even", footprint="Connector_PinHeader_2.54mm:PinHeader_2x11_P2.54mm_Vertical")
		breakout(hdr, 3, self.amp, "SDA")
		hdr[3] += hdr[4]
		breakout(hdr, 5, self.amp, "SCL")
		hdr[5] += hdr[6]
		hdr[7] += self.gnd
		hdr[8] += self.gnd
		breakout(hdr, 9, self.amp, "GPIO0")
		breakout(hdr, 10, self.amp, "GPIO1")
		breakout(hdr, 11, self.amp, "GPIO2")
		hdr[12] += self.gnd
		breakout(hdr, 13, self.amp, "MCLK")
		breakout(hdr, 14, self.amp, "SCLK")
		breakout(hdr, 15, self.amp, "SDIN")
		breakout(hdr, 16, self.amp, "LRCK/FS")
		breakout(hdr, 17, self.amp, "~SPK_MUTE")
		breakout(hdr, 18, self.amp, "~SPK_FAULT")
		for i in range(19, 23):
			hdr[i] += self.gnd
		
		# pin 1 and 2 are 5V in
		raw_5v = Net("RAW5V")
		hdr[1].drive = skidl.POWER
		hdr[1] += raw_5v
		hdr[2] += raw_5v
		self.power_supply_v50_to_v33(hdr[1], self.v33)

	
		hdr = Part("Connector_Generic", "Conn_01x02", footprint=POWER_CONNECTOR)
		hdr[1] += self.pvdd
		hdr[2] += self.gnd
		hdr[1].drive = skidl.POWER

		hdr = Part("Connector_Generic", "Conn_01x04", footprint=SPEAKER_CONNECTOR)
		hdr[1] += SPK_OUTAP
		hdr[2] += SPK_OUTAM
		hdr[3] += SPK_OUTBM
		hdr[4] += SPK_OUTBP


	@subcircuit
	def power_supply_v50_to_v33(self, raw_5v, v33_rail):
		# Raw 5V power net

		# Regulated 3.3V power net
		# Hookup barrel jack
		#jack[1] += raw_5v
		#jack[2] += self.gnd
		# Build and hookup regulator
		reg=Part('Regulator_Linear','LD1117S12TR_SOT223', footprint='Package_TO_SOT_SMD:SOT-223-3_TabPin2')
		reg["VI"] += raw_5v
		reg["GND"] += self.gnd
		reg["VO"] += v33_rail
		# Decouple the regulator
		self.decouple(raw_5v, ["0.1uF", "47uF"], footprint=CAP_TH, polarized=True)
		self.decouple(v33_rail, ["10uF"], footprint=CAP_TH, polarized=True)
		# Power LED
		current_limit_r = Part("Device","R", value="300", footprint=SMT0805) # self.R_0805("300")
		led = Part("Device","LED",footprint="LED_SMD:LED_0805_2012Metric")
		current_limit_r[1,2] += v33_rail, led[1]
		led[2] += self.gnd


	@subcircuit
	def decouple(self, pin, values, ref=None, footprint=None, polarized=False):
		assert footprint
		for value in values:
			#electro = value in [C_47UF, C_10UF]
			#electro = False
			
			part = "CP" if polarized else "C"
			#footprint = "Capacitor_THT:CP_Radial_D5.0mm_P2.50mm" if electro else "Capacitor_SMD:C_0805_2012Metric_Pad1.15x1.40mm_HandSolder"
			c = Part('device', 'C', value=value, footprint=footprint, ref=ref)
			#self.circuit += c
			#print("c",c[1],"pin",pin)

			c[1] += pin
			c[2] += self.gnd

def tas5754m():
	amp = CheapSkateTAS5754M()
	amp.circuit.ERC()
	amp.circuit.generate_netlist(file_="amp.net")
	annotate.annotate(__file__, "tas5754.txt")
	#json.dump(refs, open("refs.json","w"))


if __name__=="__main__":
	skidl.lib_search_paths[skidl.KICAD].append('./libs/')

	tas5754m()