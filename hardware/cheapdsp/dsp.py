import skidl
from skidl import Net, Part, Circuit, subcircuit
import traceback
import json

C_100NF="100nF"
C_47UF="47uF"
C_10UF="10uF"

# TODO make polarized for certain cap values

#fp_trace = open("trace.txt","w")
refs = {}
OldPart = Part
def Part(*args, **kwargs):
	global refs
	ret = OldPart(*args, **kwargs)
	for i in traceback.extract_stack():
		#print i
		fname, line, funcname, frame = i
		#print fname, fname.find(u"dsp.py")
		if fname.find("dsp.py") != -1:
			if line not in refs:
				refs[line] = []
			refs[line].append(ret.ref)
			#print refs[line]
	#fp_trace.write(ret.ref +"\n\n")
	#fp_trace.write("".join(traceback.format_stack()))
	return ret

class Foo:
	def __init__(self, circuit):
		global refs
		refs = {}
		self.circuit = circuit
		self.circuit.mini_reset()
		self.build()

	@subcircuit
	def build(self):
		self.gnd = Net("GND")
		self.vcc = Net("VCC")
		vo = Net("VO")
		p1 = Part("Device", "R", value="1k")
		p2 = Part("Device", "R", value="1k")
		self.vcc += p1[1]
		vo += p1[2]
		vo += p2[1]
		self.gnd += p2[2]




#@skidl.subcircuit
class DSP:
	def __init__(self, circuit=None):
		self.circuit = Circuit() if circuit is None else circuit
		self.circuit.mini_reset()
		self.gnd = Net("GND")
		self.gnd.drive = skidl.POWER
		self.circuit += self.gnd
		self.build(circuit=self.circuit)

	@subcircuit
	def build(self):
		self.power_supply_v33()
		self.dsp()

	@subcircuit
	def decouple(self, pin, values):
		for value in values:
			electro = value in [C_47UF, C_10UF]
			part = "CP" if electro else "C"
			footprint = "Capacitor_THT:CP_Radial_D5.0mm_P2.50mm" if electro else "Capacitor_SMD:C_0805_2012Metric_Pad1.15x1.40mm_HandSolder"
			c = Part('Device', 'C', value=value, footprint=footprint)
			#self.circuit += c
			#print("c",c[1],"pin",pin)

			c[1] += pin
			c[2] += self.gnd



	@subcircuit
	def self_boot(self):
		selfboot = Net("SELFBOOT")
		wp = Net("WP")
		# Pull up wp
		self.pullup(self.v33, "10k", wp)
		wp_eeprom = Net("WP_EEPROM")
		self.dsp["WP"] += wp
		self.dsp["SELFBOOT"] += selfboot
		# TODO: WP should have a pullup?.
		prom = Part("Memory_EEPROM","24LC32",footprint="Package_SO:SOIC-8_3.9x4.9mm_P1.27mm")
		prom["A0"] += self.gnd
		prom["A1"] += self.gnd
		prom["A2"] += self.gnd
		prom["SDA"] += self.sda
		prom["SCL"] += self.scl
		prom["WP"] += wp_eeprom
		prom["GND"] += self.gnd
		prom["VCC"] += self.v33
		self.decouple(prom["VCC"],[C_100NF])

		# TODO: should WP be broken out like this?
		hdr = Part("Connector_Generic", "Conn_02x03_Odd_Even", footprint="Connector_PinHeader_2.54mm:PinHeader_2x03_P2.54mm_Vertical")
		hdr[1] += wp
		hdr[3] += wp_eeprom
		hdr[5] += self.gnd
		hdr[2] += self.v33
		hdr[4] += selfboot
		hdr[6] += self.gnd


	@subcircuit
	def power_supply_v33(self):
		jack=Part('Connector','Barrel_Jack', footprint='Connector_BarrelJack:BarrelJack_Horizontal')
		# Raw 5V power net
		self.pwr = Net("RAW_+5V")
		self.pwr += jack[1]
		self.pwr.drive = skidl.POWER
		# Regulated 3.3V power net
		self.v33 = Net('+3V3')
		# Hookup barrel jack
		jack[1] += self.pwr
		jack[2] += self.gnd
		# Build and hookup regulator
		reg=Part('Regulator_Linear','LD1117S12TR_SOT223', footprint='Package_TO_SOT_SMD:SOT-223-3_TabPin2')
		reg["VI"] += self.pwr
		reg["GND"] += self.gnd
		reg["VO"] += self.v33
		# Decouple the regulator
		self.decouple(self.pwr, [C_100NF, C_47UF])
		self.decouple(self.v33, [C_10UF])
		# Power LED
		current_limit_r = self.R_0805("300")
		led = Part("Device","LED",footprint="LED_SMD:LED_0805_2012Metric")
		current_limit_r[1,2] += self.v33, led[1]
		led[2] += self.gnd


	def R_0805(self, value):
		return Part("Device", "R", value=value, footprint="Resistor_SMD:R_0805_2012Metric_Pad1.15x1.40mm_HandSolder")
	def C_0805(self, value):
		return Part("Device", "C", value=value, footprint="Capacitor_SMD:C_0805_2012Metric_Pad1.15x1.40mm_HandSolder")
	def CP_ELEC(self, value):
		return Part("Device", "CP", value=value, footprint="Capacitor_THT:CP_Radial_D5.0mm_P2.50mm")

	def CP_0805(self, value):
		return Part("Device", "CP", value=value, footprint="Capacitor_SMD:C_0805_2012Metric_Pad1.15x1.40mm_HandSolder")
	def pullup(self, voltage, value, pin):
		r = self.R_0805(value)
		r[1,2] += voltage, pin

	@subcircuit
	def dsp(self):
		# Build dsp
		self.dsp = Part("DSP_AnalogDevices","ADAU1701",footprint="Package_QFP:LQFP-48_7x7mm_P0.5mm")
		print(self.dsp.pins)
		self.dsp["RSVD"] += self.gnd  # Reserved tie to ground either directly or through pullup page 12

		# Basic chip functionality
		self.power_and_ground()
		self.regulator_dvdd()  # power
		self.pll()
		self.reset()
		self.oscillator()
		# I2C and Boot modes
		self.i2c()
		self.self_boot()
		# Analog IO
		self.analog_inputs()
		self.analog_outputs()
		self.analog_terminal_block()
		# Remaining IO
		self.io_header()
		self.mcu_header()
		self.analog_outputs_decoupling()

	@subcircuit
	def power_and_ground(self):
		# Common ground plane page 11 (pins 1, 37, 42, 12, 25, 33)
		for p in self.dsp["DGND"] + self.dsp["AGND"] + [self.dsp["PGND"]]:
			self.gnd += p

		# Filter decoupling
		self.decouple(self.dsp["FILTA"], [C_10UF, C_100NF])
		self.decouple(self.dsp["FILTD"], [C_10UF, C_100NF])
		# CM common mode reference Page 13
		self.decouple(self.dsp["CM"], [C_47UF, C_10UF, C_100NF])

		# AVDD decoupling and connection page 13
		for i in self.dsp["AVDD"]:
			self.decouple(i, [C_100NF])
			i += self.v33
		self.decouple(self.dsp["AVDD"][0], [C_10UF])
		# PLL power page 13
		self.decouple(self.dsp["PVDD"], [C_100NF])
		self.dsp["PVDD"] += self.v33

		# IOVDD
		self.decouple(self.dsp["IOVDD"], [C_100NF, C_10UF])
		self.dsp["IOVDD"] += self.v33


	@subcircuit
	def pll(self):
		# TODO pll mode, clock selection page 18
		# TODO pll filter page 18
		def chain1():
			c1 = self.C_0805("56nF")
			r = self.R_0805("465")
			self.v33 += r[1]
			r[2] += c1[1]
			c1[2] += self.dsp["PLL_LF"]
		chain1()

		def chain2():
			c2 = self.C_0805("3.3nF")
			self.v33 += c2[1]
			c2[2] += self.dsp["PLL_LF"]
		chain2()

		# TODO: should this bbe header programmable?
		self.dsp["PLL_MODE0"] += self.gnd
		self.dsp["PLL_MODE1"] += self.v33



	@subcircuit
	def mcu_header(self):
		"""Build a header that has pins for programming features."""
		header = Part("Connector_Generic","Conn_01x09",
			          footprint="Connector_PinHeader_2.54mm:PinHeader_1x09_P2.54mm_Vertical")		
		header[1] += self.get_net_by_name("RAW_+5V")
		header[2] += self.gnd
		header[3] += self.sda
		header[4] += self.scl
		header[5] += self.get_net_by_name("WP")
		header[6] += self.get_net_by_name("SELFBOOT")
		header[7] += self.get_net_by_name("~RESET")
		header[8] += skidl.NCNet()
		header[9] += skidl.NCNet()

	@subcircuit
	def io_header(self):
		header = Part("Connector_Generic","Conn_02x11_Odd_Even",
			          footprint="Connector_PinHeader_2.54mm:PinHeader_2x11_P2.54mm_Vertical")
		header[1,2] += self.v33, self.v33

		# Breakout pins 
		def breakout(dsp_pin_name):
			pin = self.dsp[dsp_pin_name]
			net = Net(dsp_pin_name) 
			net += pin
			return net
		#breakout("~RESET", 4) 
		header[3] += self.get_net_by_name("~RESET")
		header[4] += breakout("MP4")    # IN_LRCLK
		header[5] += breakout("MP5")    # IN_BCLK
		header[6] += breakout("MP1") 
		header[7] += breakout("MP0")  # SDATA_IN
		header[8] += breakout("MP7") 
		header[9] += breakout("MP6") 
		header[10] += breakout("MP10") 
		header[11] += breakout("MP11") 
		header[12] += self.sda
		header[13] += skidl.NCNet()  # Unconnected!
		header[14] += breakout("MP9")
		header[15] += self.scl
		header[16] += breakout("MP3")
		header[17] += breakout("MP8")
		header[18] += breakout("MP2")
		header[19] += self.get_net_by_name("MCLK_EXT")
		header[20,21,22] += self.gnd, self.gnd, self.gnd

	def get_net_by_name(self, name):
		for i in self.circuit.nets:
			if i.name == name: return i
		raise RuntimeError("Failed to find net %s"% name)

	@subcircuit
	def oscillator(self):
		# See page 18
		# Idea here is that a jumper selects between internal and external clock
		r = self.R_0805("100")
		c1 = self.C_0805("22pF")
		c2 = self.C_0805("22pF")
		MCLK_INT = Net("MCLK_INT")
		# osc = Part("Device","Crystal", footprint="Crystal:Crystal_SMD_7050-2Pin_7.0x5.0mm_HandSoldering")
		osc = Part("Device","Crystal", footprint="dsp2lib:HC-49SMD-aselle")

		self.dsp["OSCO"] += r[1]
		# First capacitor
		r[2] += osc[1]
		r[2] += c1[1]
		c1[2] += self.gnd
		# Second capacitor		
		osc[2] += c2[1]
		c2[2] += self.gnd
		c2[1] += MCLK_INT
		# Oscillator selector
		MCLK_CHOSEN = Net("MCLK_CHOSEN")
		self.dsp["MCLKI"] += MCLK_CHOSEN
		hdr = Part("Connector_Generic","Conn_01x03",
			          footprint="Connector_PinHeader_2.54mm:PinHeader_1x03_P2.54mm_Vertical")		
		#hdr = Part("Connector_Generic", "Conn_02x03_Odd_Even", footprint="Connector_PinHeader_2.54mm:PinHeader_2x03_P2.54mm_Vertical")
		hdr[1] += MCLK_INT
		hdr[2] += MCLK_CHOSEN
		hdr[3] += Net("MCLK_EXT")
		#hdr[2] += skidl.NCNet()
		#hdr[4] += skidl.NCNet()
		#hdr[6] += skidl.NCNet()

	@subcircuit
	def analog_terminal_block(self):
		# term = Part("Connector","Screw_Terminal_01x12",footprint="TerminalBlock_RND:TerminalBlock_RND_205-00011_1x12_P5.00mm_Horizontal")
		term = Part("Connector","Screw_Terminal_01x12",footprint="Ningbo-Kangnex-Elec-WJ2EDGR-5-08-12P")
		term[2] += self.gnd
		idx = 1
		name_to_net={}
		for i in  self.circuit.nets:
			name_to_net[i.name] = i
		for ain in range(2):
			term[idx] += name_to_net["AIN%d" % ain]
			idx += 1
			term[idx] += self.gnd
			idx += 1
		for aout in range(4):
			term[idx] += name_to_net["FILTER_VOUT%d" % aout]
			idx += 1
			term[idx] += self.gnd
			idx += 1


	@subcircuit
	def i2c(self):
		# I2C bus parameters
		self.sda = Net("SDA")
		self.scl = Net("SCL")
		self.dsp["SDA/COUT"] += self.sda
		self.dsp["SCL/CCLK"] += self.scl

		# I2C buses need pullups... can do it anywhere
		# but we need it on the board incase we are self-hosting
		self.pullup(self.v33, "10k", self.scl)
		self.pullup(self.v33, "10k", self.sda)

		# Address
		addr0 = Net("ADDR0")
		addr1 = Net("ADDR1")
		self.dsp["ADDR0"] += addr0
		self.dsp["ADDR1/CDATA/WB"] += addr1
		# Address configuration
		addr_hdr = Part("Connector_Generic", "Conn_02x03_Odd_Even", footprint="Connector_PinHeader_2.54mm:PinHeader_2x03_P2.54mm_Vertical")
		addr_hdr[1] += self.v33
		addr_hdr[2] += self.v33
		addr_hdr[3] += addr0
		addr_hdr[4] += addr1
		addr_hdr[5] += self.gnd
		addr_hdr[6] += self.gnd

	@subcircuit
	def reset(self):
		# Page 11
		reset = Net("~RESET")
		self.dsp["~RESET"] += reset
		self.decouple(reset, [C_100NF])
		self.pullup(self.v33, "10k", reset)
		sw = Part("Switch","SW_Push",footprint="Button_Switch_THT:SW_PUSH_6mm")
		sw[1] += reset
		sw[2] += self.gnd


	@subcircuit
	def regulator_dvdd(self):
		# Page 9
		# Builtin 3.3V -> 1.2V voltage regulator
		# This transistor is the drive for the current source in the 1.2V reuglator
		dvdd = Net("DVDD")
		dvdd.drive = skidl.POWER
		t = Part("Device", "Q_PNP_BCE", footprint="Package_TO_SOT_SMD:SOT-223-3_TabPin2")
		t["B"] += self.dsp["VDRIVE"]
		t["C"] += self.dsp["DVDD"]
		t["E"] += self.v33
		r = self.R_0805("1k")
		r[1] += t["E"]
		r[2] += t["B"]
		# DVDD decoupling
		dvdd += self.dsp["DVDD"]
		for i in self.dsp["DVDD"]:
			self.decouple(i, [C_100NF])
		self.decouple(self.dsp["DVDD"][0], [C_10UF])


	@subcircuit
	def analog_inputs(self):
		# Page 20 -- adc resistor to set to full range
		adc_res = self.R_0805("18k")
		self.dsp["ADC_RES"] += adc_res[1]
		adc_res[2] += self.gnd
		# Get the ADC going
		ain0 = Net("AIN0")
		ain1 = Net("AIN1")
		adc0 = Net("ADC0")
		adc1 = Net("ADC1")
		self.single_analog_input(ain0, adc0)
		self.single_analog_input(ain1, adc1)
		self.dsp["ADC0"] += adc0
		self.dsp["ADC1"] += adc1

	@subcircuit
	def single_analog_input(self, in_net, out_net):
		r = self.R_0805("49.9k")
		c1 = self.CP_ELEC("10uF")  # TODO switch to polarized
		c2 = self.C_0805("100pF")
		in_net += r[1]
		in_net += c1[1]
		in_net += c2[1]
		c2[2] += self.gnd
		r[2] += self.gnd

		r7=self.R_0805("7k")
		r8=self.R_0805("8k")
		r18=self.R_0805("18k")
		# This header chooses between voltages. output of AC coupling cap goes to three pins
		# resistors leave the opposite three pins, and a jumper is placed over 
		hdr = Part("Connector_Generic", "Conn_02x03_Odd_Even", footprint="Connector_PinHeader_2.54mm:PinHeader_2x03_P2.54mm_Vertical")
		# jumper position 1
		hdr[1] += r7[1]
		hdr[2] += c1[2]
		# jumper position 2
		hdr[3] += r8[1]
		hdr[4] += c1[2]
		# jumper position 3
		hdr[5] += r18[1]
		hdr[6] += c1[2]

		# whichever is active is sent to the output net
		r7[2] += out_net
		r8[2] += out_net
		r18[2] += out_net


	@subcircuit
	def analog_outputs_decoupling(self):
		"Forgot to decouple opamp... doing at end to make out stable."
		self.decouple(self.opamp["V+"], [C_100NF, C_10UF])

	@subcircuit
	def analog_outputs(self):
		# 4 analog outputs
		# TODO: check these pins
		opamp = Part("Device","Opamp_Quad_Generic", footprint="Package_SO:TSSOP-14_4.4x5mm_P0.65mm")
		self.opamp = opamp
		opamp["V+"] += self.v33
		opamp["V-"] += self.gnd
		opamp_pin_nums = [[3,2,1], [5,6,7], [10,9,8], [12,13,14]]
		for i in range(4):
			vout_name = "VOUT%d" % i
			pin = self.dsp[vout_name]
			raw_out = Net(vout_name)
			filter_out = Net("FILTER_" + vout_name)
			pin += raw_out
			opamp_pins = [opamp[x] for x in opamp_pin_nums[i]]
			self.single_analog_output(raw_out, opamp_pins, filter_out)

	@subcircuit
	def single_analog_output(self, in_net, opamp_pins, out_net):
		# When populating board, you can populate either
		# the passive or the active filter.. but not both!
		# passive filter...
		@subcircuit
		def passive():
			r = self.R_0805("560")
			c1 = self.CP_ELEC("47uF")
			c2 = self.CP_0805("5.6nF")
			c1[1,2] += in_net, r[1]
			r[2] += out_net
			c2[1,2] += out_net, self.gnd
		# active filter...
		@subcircuit
		def active(opamp_pins):
			opamp_plus, opamp_minus, opamp_output = opamp_pins
			r1 = self.R_0805("4.75k")
			r2 = self.R_0805("4.75k")
			c_feedback = self.CP_0805("470pF")
			c_gnd = self.CP_0805("150pF")
			c_ac = self.CP_ELEC("10uF")
			r1[1,2] += in_net, r2[1]

			r1[1] += in_net
			r1[2] += r2[1]
			r1[2] += c_feedback[1]
			r2[2] += c_gnd[1]
			c_gnd[2] += self.gnd
			
			# This moved externally so we could use quad opamp
			#opamp = Part("Amplifier_Operational","AD8603",footprint="Package_TO_SOT_SMD:TSOT-23-5")
			#opamp[5] += self.v33  # TODO: is tthis correct?
			#opamp[3] += c_gnd[1]
			#opamp[4] += opamp[1]
			#opamp[1] += c_feedback[2]
			#opamp[2] += self.gnd
			#opamp[1] += c_ac[1]

			opamp_output += c_feedback[2]
			opamp_output += c_ac[1]
			opamp_plus += r2[2]
			opamp_minus += opamp_output

			
			self.R_0805("604")[1,2] += c_ac[2], out_net
			self.CP_0805("3.3nF")[1,2] += out_net, self.gnd
			self.R_0805("49.9k")[1,2] += out_net, self.gnd 

		passive()
		active(opamp_pins)


def dsp(circuit):
	"""Build a dsp circuit. 

	Note we pass in circuit so we can use a reload loop for faster iteration.
	"""
	dsp =DSP(circuit)
	dsp.circuit.ERC()  # rule check!
	dsp.circuit.generate_netlist(file_="dsp.net")
	json.dump(refs, open("refs.json","w"))



if __name__=="__main__":
	dsp(None)
