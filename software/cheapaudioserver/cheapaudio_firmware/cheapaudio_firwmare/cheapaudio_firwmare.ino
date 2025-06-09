/*
Copyright Andrew Selle 

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

//#define CHEAPAUDIO_ESP32
#define CHEAPAUDIO_ESP8266

#ifdef CHEAPAUDIO_ESP32
#include <WiFi.h>
#include <WiFiMulti.h>
#include <ESPmDNS.h>        // Include the mDNS library
#include <WebServer.h>
///#include <SPIFFS.h>   // Include the SPIFFS library
#include "SPIFFS.h"
#elif defined(CHEAPAUDIO_ESP8266)
#include <ESP8266WiFi.h>
#include <ESP8266WiFiMulti.h>
#include <ESP8266mDNS.h>        // Include the mDNS library
#include <ESP8266WebServer.h>
#include <ESP8266WebServerSecure.h>
#include <WiFiManager.h>          //https://github.com/tzapu/WiFiManager WiFi Configuration Magic
#include <DNSServer.h>            //Local DNS Server used for redirecting all requests to the configuration portal

#include <RotaryEncoder.h> // Enjoyneering  https://github.com/enjoyneering/RotaryEncoder

#include <FS.h>
#endif
#include "ADAU1701.h"
#include "ADAU1701_REGISTERS.h"
#include "TAS5754M.h"

// display
#include <U8g2lib.h>

// more
#include "EEPROM24.h"
#include "I2CMaster.h"
#include "SoftI2C_mod.h"
#include "GenI2C.h"
#include <JsonStreamingParser.h>

#define USE_DISPLAY
#undef USE_ENCODER

#if defined(CHEAPAUDIO_ESP8266)
using WiFiMulti = ESP8266WiFiMulti;
using WebServer = ESP8266WebServer;
#endif

WiFiMulti wifiMulti;

#define FONT u8g2_font_t0_22b_mf    
#define FONTSM u8g2_font_6x13_mr     
U8G2_SH1106_128X64_NONAME_F_SW_I2C u8g2(U8G2_R0,D1, D2);

#define ENCODER_PIN1 D5
#define ENCODER_PIN2 D6
volatile int encoder_update_delay = 100; // decaying counter to delay updates if we are getting things too fast

class VolumeEncoder {
  public:
  VolumeEncoder(RotaryEncoder& encoder)
    :encoder(encoder), dB(255)
  {}

  void begin();
  void updateVolume(int code);

  void update() {
    if(encoder_update_delay > 0) {
      encoder_update_delay--;
      if(encoder_update_delay == 0) {
        int counter = encoder.getPosition();
        encoder.setPosition(0);
        dB -= 5*counter;
        if(dB < 0) dB = 0;
        else if(dB > 255) dB = 255;
        updateVolume(dB);
      }
    }
  }
  int dB;
  RotaryEncoder& encoder;
};
#ifdef USE_ENCODER
RotaryEncoder encoder(ENCODER_PIN1, ENCODER_PIN2, D7);
VolumeEncoder volume(encoder);
#endif

//how many clients should be able to telnet to this ESP32
#define MAX_SRV_CLIENTS 2
// You shouldn't need this anymore since we use the auto setup
//const char* ssid = "";
//const char* password = "";

static const char* boot_json_file = "/boot.json";

/* TODO(aselle): add private keys 
static const char serverCert[] PROGMEM = R"EOF(
)EOF";
static const char serverKey[] PROGMEM =  R"EOF(
)EOF";
*/
static const char serverCert[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIICwjCCAiugAwIBAgIJANDo3S5H+gshMA0GCSqGSIb3DQEBCwUAMHoxCzAJBgNV
BAYTAlJPMQowCAYDVQQIDAFCMRIwEAYDVQQHDAlCdWNoYXJlc3QxGzAZBgNVBAoM
Ek9uZVRyYW5zaXN0b3IgW1JPXTEWMBQGA1UECwwNT25lVHJhbnNpc3RvcjEWMBQG
A1UEAwwNZXNwODI2Ni5sb2NhbDAeFw0xOTA3MjgxMTU4MzhaFw0yMDA3MjcxMTU4
MzhaMHoxCzAJBgNVBAYTAlJPMQowCAYDVQQIDAFCMRIwEAYDVQQHDAlCdWNoYXJl
c3QxGzAZBgNVBAoMEk9uZVRyYW5zaXN0b3IgW1JPXTEWMBQGA1UECwwNT25lVHJh
bnNpc3RvcjEWMBQGA1UEAwwNZXNwODI2Ni5sb2NhbDCBnzANBgkqhkiG9w0BAQEF
AAOBjQAwgYkCgYEAuk9E3PyoBzIed/NJB0lZTt9JrP4ISForJdMwLtc2tqK401P+
ZxpEl+9z2WU4NnGrRjEFALaW3i9QpfWlnASJbBdw2MICxMV3+cSfpApeKJQAOupY
nSmrekhMtw4mXDwg1OVcZKJ+lN8z169Bsr/7zRHViwttWZ7X0SN0+qJYaj0CAwEA
AaNQME4wHQYDVR0OBBYEFJ1VcFlP1mudbLWPaDyhSo1ARgzDMB8GA1UdIwQYMBaA
FJ1VcFlP1mudbLWPaDyhSo1ARgzDMAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQEL
BQADgYEAuD7nrQAh1HkqT34exEI/ty6V6Rh9Y2OBSvxpzYL/6h4LgVsBsmsfieet
wSpmXvE6VGT6ogLWnoW6Ofrak8EhtRV2z8K2/FHw/vOCK9Y4vKImciPbCUjUFe4z
vb0DMbUgvcd4SYGleVpHqZUBfUC4LZY13i0movp2dCZ4EOuf3Jk=
-----END CERTIFICATE-----
)EOF";

static const char serverKey[] PROGMEM =  R"EOF(
-----BEGIN PRIVATE KEY-----
MIICdwIBADANBgkqhkiG9w0BAQEFAASCAmEwggJdAgEAAoGBALpPRNz8qAcyHnfz
SQdJWU7fSaz+CEhaKyXTMC7XNraiuNNT/mcaRJfvc9llODZxq0YxBQC2lt4vUKX1
pZwEiWwXcNjCAsTFd/nEn6QKXiiUADrqWJ0pq3pITLcOJlw8INTlXGSifpTfM9ev
QbK/+80R1YsLbVme19EjdPqiWGo9AgMBAAECgYAC9CTEWCEV1B6Vij7bJbeLv5B8
dJ6O/xb2B44ZAAJ3DMdfWlKLMehqfDpa9PbaLh0oBLjulPZ5WUivCODyQ0QmcpwC
mokgEsRPLXLySw0E8xe4839Ivp13kxO28nA1Usqd2bUI3mt3wUVl6aiu7hqwAz3l
dBlm9V6feG5cKnuWRQJBAOl1efQU8svUcaIalh2Va+BMaroSPdcVC+M5uQoNdgbZ
1Yip7Ke/UWAcKAzJEsP/0g7A916ghmm/QK1tpWEPGL8CQQDMTGFhVmLhJt8rmwv0
WGIAqDjZu9dW+HKyH41gs7D83l6is0/zw+bq+VWwH0lOnpHSEjAiXTIfw1o95LDz
fOADAkEAq3yLlGs+3dKzlauJ0TlNAHmhfASiQDdJgCOKdIPmyqmAXN7U43N5Ruvn
z1xz2F0143iDPJMVqN+/lqUP8few6QJAcwmjX/ML1KpVyjERJzLJZINVF8288P0P
YJuBuW0VgR4Z/dWodKPgGHnztSu41KtXgwm4zvDZc6dF3kozFbhATwJBAK9YTSfV
PF2aK3buOOsXY4PkcFPlhn1UkN1EbIIwIN6D2GW8hu7tUBZUjRyZzANmRZeTbbha
PUzcNRWVCu4BWkY=
-----END PRIVATE KEY-----
)EOF";


// Define server classes

WiFiServer telnet_server(23);
WiFiServer adau1701_server(8000);
WiFiClient serverClients[MAX_SRV_CLIENTS];
WebServer webserver(80);
BearSSL::ESP8266WebServerSecure webserver_secure(443);

typedef void (*ClientHandler)(WiFiClient* client);
ClientHandler handlers[MAX_SRV_CLIENTS];
void parseJsonFileAndProgram(const char* filename);
void webServerHandleSend();
void webServerHandleUpload();

// Defines for DSP communication.
#if defined(ESP8266)
constexpr uint8_t DSP_SDA = D2;
constexpr uint8_t DSP_SCL = D1;
constexpr uint8_t DSP_WP = D6;
constexpr uint8_t DSP_RES = D7;
#elif defined(ESP32)
constexpr uint8_t DSP_SDA = 26;
constexpr uint8_t DSP_SCL = 25;
constexpr uint8_t DSP_WP = 32;
constexpr uint8_t DSP_RES = 33;
#endif
constexpr uint8_t AMP_ADDRESS = 0;
constexpr uint8_t AMP_ADDRESS_2 = 1;
constexpr uint8_t AMP_ADDRESS_3 = 2;
constexpr uint8_t AMP_ADDRESS_4 = 3;

constexpr uint8_t DSP_ADDRESS = 0;
constexpr uint8_t DSP_FIX_ADDR = 0;


SoftI2C i2c(DSP_SDA, DSP_SCL);
ADAU1701 dsp(i2c, DSP_ADDRESS, 0x70);
TAS5754M tas(i2c, AMP_ADDRESS);
TAS5754M tas2(i2c, AMP_ADDRESS_2);
TAS5754M tas3(i2c, AMP_ADDRESS_3);
TAS5754M tas4(i2c, AMP_ADDRESS_4);
GenI2C gen_i2c(i2c);

struct Cmd {
  uint8_t addr, data;
};

void setupDSP() {
  // Set all ports to open drain!
  auto SetOpenDrain = [](uint8_t pin) {
    pinMode(pin, INPUT);
    digitalWrite(pin, LOW);
  };
  SetOpenDrain(DSP_SDA);
  SetOpenDrain(DSP_SCL);
  SetOpenDrain(DSP_WP);
  SetOpenDrain(DSP_RES);
  
  // mute amp
  Serial.println("muting amp");
  // Soft mute before shutdown
  auto mute = [](TAS5754M& amp) {
    uint8_t data=0x11;
    amp.write(3,1,&data); // mute
    amp.write(2,1,&data); // powerdown & standby
  };
  mute(tas);
  mute(tas2);
  mute(tas3);
  mute(tas4);
}

void configureAmp() {
  
  auto setupAmp = [](TAS5754M& amp, int offset) {
    static Cmd amp_setup_cmds[] = {
                 // {2, 0x10}, // P0-R2   set to standby
                 // {13, 0x10}, // P0-R13  set PLL reference clk to MCLK
                 // {37, 0x08}, // P0-R37  ignore mclk  
                // {2, 0x00}, // P0-R2   set normal operating mode 
                //  {62, 0x30}, // P0-R62   volume a = -infty
                //  {61, 0x30}, // P0-R61   volume b = -infty
                //  {40, 0x13} ,       // P0-R40  TDM / 32 bits
                //  {41, 64*offset},         //  offset 0 
                //  {0xff, 0xff}, // Terminate command

                 {2, 0x10},    // P0-R2   set to standby
                  {2, 0x10},    // P0-R2   set to standby
                  {0, 0x11}, // P0-R2 reset registers
                  {0, 0x00}, // P0-R2 reset registers
                  {13, 0x00},   //// P0-R13  set PLL reference clk to MCLK
                  {4, 0x01},    //// P0-R4  enable pll
                  {14, 0x30},   // manual clock
                  {20, 0x1},    // P0-R20 set P=2
                  {21, 0x10},   // P0-R21 set J = 16
                  {22, 0x0},    //P0-R21 set D=0
                  {24, 0x0},    // P0-R24  s.t. R=1
                  {27, 0x1},    //P0-27  NMAC is divide by 2  so use 1
                  {28, 0xf},    //P0-28  NDAC is dive by 16 so use 15
                  {29, 0x3},    //P0-29  NCP clock divide by 4 so use 3
                  {30, 0x7},    // P0-30  OSR clock divider by 8 so use 7
                  {37, 0x08},   //// P0-R37  ignore mclk
                  {62, 0x60},   // P0-R62   volume a = -infty
                  {61, 0x60},   // P0-R61   volume b = -infty
                  {40, 0x13} ,  // TDM / 32 bits
                  {9, 0x00},    // set inverted sclk
                  {41, 64*offset},      //  offset 0
                  {2, 0x00},    //// P0-R2   set normal operating mode
                  {42, 0x11},    // S
                  {3, 0x00}, // unmute
                  {0xff, 0xff}
    };
    for(Cmd* cmd = amp_setup_cmds; cmd->addr != 0xff; cmd++)
      amp.write(cmd->addr, 1, &(cmd->data));
    uint8_t data = 64*offset;
    amp.write(41, 1, &data);
      //delay(50);
  };
  delay(100);
  setupAmp(tas, 0);
  setupAmp(tas2, 1);
  setupAmp(tas3, 2);
  setupAmp(tas4, 3);  
}

struct FileServeMap {
  static constexpr int max_files = 32;
  String filenames[max_files]; // TODO: check
  String indices[max_files];
  int count = 0;

  void load() {
    char buf[256]; // TODO: check
    File fp = SPIFFS.open("/fspack/index.txt", "r");
    Serial.println("reading index.txt...");
    while(fp.available()) {
      int len = 0;
      while(1){
        int c = fp.read();
        // TODO: check buffer.
        if(c == '\n' || len == sizeof(buf)-1) break;
        else buf[len++] = c;
      }
      buf[len] = 0;
      
      int split = 0;
      char* real_filename = buf + len;
      for(; split < len; split++) {
        if (buf[split] == ' ') {
          buf[split] = 0;
          real_filename = buf + split + 1; 
          break;
        }
      }
      Serial.printf("Got %s %s\n", buf, real_filename);
      // record file
      indices[count] = buf;
      filenames[count] = real_filename;
      count++;
    }
  }

  const String* find(const String& uri_raw) {
    // TODO(aselle): O(n) may be performance problem

    for(int i = 0; i < count; i++) {
      Serial.print("Consider '");
      Serial.print(filenames[i]);
      Serial.print("' vs '");
      Serial.print(uri_raw);
      Serial.println("'");
      
      if(filenames[i] == uri_raw) {
        Serial.println(" msatc");
        return &indices[i];
      }
    }
    return nullptr;
  }

};
FileServeMap file_serve_map;

bool serve_file(const String& uri_raw) {
  String uri = uri.endsWith("/") ? uri_raw + "index.html" : uri_raw;
  Serial.print("uri ");
  Serial.println(uri);
  auto mime = [](const String& uri) {
    if(uri.endsWith(".html")) return "text/html";
    else if (uri.endsWith(".js")) return "application/javascript"; 
    else if (uri.endsWith(".css")) return "text/css";
    else return "text/plain";
  };

  const String* spiffs_filename;

  if(SPIFFS.exists(uri)) {
    File fp = SPIFFS.open(uri, "r");
    webserver.streamFile(fp, mime(uri));
  } else if(spiffs_filename = file_serve_map.find(uri)) {
    File fp = SPIFFS.open("/fspack/" + *spiffs_filename, "r");
    webserver.streamFile(fp, mime(uri));
  } else {
    return false;
  }

  return true;
}

void setup() {
  // volume.begin();
  Serial.begin(115200);
  Serial.println("\nConnecting");

  /*
  for(int i=0; i < 127; i++)  {
    char buf[16];
    bool foo = gen_i2c.probe(i);
    sprintf(buf, "0x%x %s", i, foo ? "yes" : "");
    Serial.println(buf);
  }*/
  
#ifdef USE_DISPLAY
  u8g2.begin();
  u8g2.clearBuffer();          // clear the internal memory
#endif  

// Setup interface hardware
  setupDSP();
  // Setup WIFI
#if defined(ESP32)
  WiFi.setHostname("dspamp");
  SPIFFS.begin(true);
#elif defined(ESP8266)
  //WiFi.hostname("dsp");
  SPIFFS.begin();
#endif

  
  // Parse and load setup before Wifi to minimize latency
  Serial.print("Reset DSP...");    
  //pinMode(DSP_WP, INPUT);
  pinMode(DSP_RES, OUTPUT);
  //pinMode(DSP)
  //digitalWrite(DSP_RES, 0);
  delay(200);
  //digitalWrite(DSP_RES, 1);
  pinMode(DSP_RES, INPUT);
  //Serial.print("Programming DSP...");    


  static bool inited=false;
  if(!inited) {
    Serial.println("loading dsp/amp");
    inited=true;
    delay(1000);
    parseJsonFileAndProgram(boot_json_file);
    configureAmp();
    //volume.updateVolume(0x60);
  }
  
  
  Serial.println("Setting up wifi");  
  const char* hostname = "dualguy";
  
  /*

  WiFiManager wifiManager;
  WiFiManagerParameter dsp_host("hostname", "hostname", "dsp", 40);
  wifiManager.addParameter(&dsp_host);

  Serial.println("dsp host");
  Serial.println(dsp_host.getValue());
  
  wifiManager.setHostname(hostname); // sethostname before autoconect
  if(!wifiManager.autoConnect()) {
    ESP.reset();
    delay(1000);
  } 
  //const char* host = dsp_host.getValue();
  //WiFi.hostname(host);

  */
  WiFi.begin("deanna-g", "theworldisnotenough5441020");
  int i = 0;
  while (WiFi.status() != WL_CONNECTED) { // Wait for the Wi-Fi to connect
    delay(1000);
    Serial.print(++i); Serial.print(' ');
  }
  Serial.println('\n');
  Serial.println("Connection established!");  
  Serial.print("IP address:\t");
  Serial.println(WiFi.localIP());

  if(!MDNS.begin(hostname)) {
    Serial.println("Error setting up MDNS");
  }

  // Print list of files
  Serial.println("File list");
  Dir dir = SPIFFS.openDir("/");
  while(dir.next()) {
    Serial.println(dir.fileName());
  }
  file_serve_map.load();

  webserver.on("/send", webServerHandleSend);
  webserver.on("/upload", HTTP_POST,  [](){
      Serial.println("Returning ready to upload...");
      webserver.send(200);
    },
    webServerHandleUpload);
  webserver.on("/hello", []() {
     webserver.send(200, "text/plain", "Hello world!");   // Send HTTP status 200 (Ok) and send some text to the browser/client
  });  
  webserver.onNotFound([](){
    if(!serve_file(webserver.uri())) {
      webserver.send(404, "text/plain", "404 not found.");
    }
  });


  // TODO(aselle): Use secure web server more
  //webserver_secure.setRSACert(new BearSSL::X509List(serverCert), new BearSSL::PrivateKey(serverKey));
  //webserver_secure.on("/hello", []() {
  //   webserver_secure.send(200, "text/plain", "Hello world!");   // Send HTTP status 200 (Ok) and send some text to the browser/client
  //});

  webserver.begin();
  // Start all servers
  telnet_server.begin();
  telnet_server.setNoDelay(true);
  adau1701_server.begin();
  adau1701_server.setNoDelay(true);
  webserver_secure.begin();
  Serial.print("Wifi bound to IP: ");
  Serial.print(WiFi.localIP());

  // CONFIGURE
  //parseJsonFileAndProgram(boot_json_file);
  //delay(500);
  //Serial.println("Configuring AMP");
  //configureAmp();


  #ifdef USE_DISPLAY
  u8g2.begin();
  u8g2.setDisplayRotation(U8G2_R2);
  u8g2.clearBuffer();          // clear the internal memory
  u8g2.setFontMode(0);        // write solid glyphs
  u8g2.setFont(FONTSM ); // choose a suitable h font
  u8g2.setCursor(0,64-13);        // set write position
  u8g2.print(WiFi.localIP());
  u8g2.setCursor(0,64-13-13);        // set write position
  u8g2.print(hostname);
  u8g2.sendBuffer();          // transfer internal memory to the display
  #endif
  
  if(MDNS.addService("http","tcp",80)) {
    Serial.println("HTTP Registered");
  }
  if(MDNS.addService("adau1701","tcp",8000)) {
    Serial.println("ADAU1701 Registered");
  }
  
  
  
  return;
  
}



// This accumulates I2C writes to the DSP into a buffer
struct WriteBufferAccumulate {
  private:
  char* write_buffer_curr = 0;
  char* end_buffer = 0;
  char write_buffer[8192];
  int safe;
  size_t address;
  size_t bytes_needed;

  public:

  size_t bytes() const { return bytes_needed;}
  void reset(int safe, size_t address, size_t bytes){
    // TODO: safe never used!.
    this->address = address;
    bytes_needed = bytes;
    write_buffer_curr = write_buffer;
    end_buffer = write_buffer + bytes_needed;
  }

  void write() {
    constexpr size_t SAFELOAD_ADDR = 0x815;
    constexpr size_t SAFELOAD_DATA = 0x810;
    if(safe) {  
      int words = bytes_needed / 4;
      int curr_addr = address;
      uint8_t* curr_data = reinterpret_cast<uint8_t*>(write_buffer);
      for(int k=0; k < words; k++) {
        uint8_t safeaddr[2];
        safeaddr[0] = (curr_addr >> 8) & 0xff;
        safeaddr[1] = curr_addr & 0xff;
        curr_addr++;
        dsp.write(SAFELOAD_ADDR + k, 2, safeaddr);

        uint8_t safedata[5] = {0,0,0,0,0};
        safedata[1] = *curr_data++;
        safedata[2] = *curr_data++;
        safedata[3] = *curr_data++;
        safedata[4] = *curr_data++;
        dsp.write(SAFELOAD_DATA + k, 5, safedata);

        // Read current control register, mmodify with 
        // safeload bit and write back.
        uint8_t ccr[ADAU_CC_WIDTH];
        dsp.read(ADAU_CC, ADAU_CC_WIDTH, ccr);
        ccr[1] |= ADAU_CCL_IST;
        dsp.write(ADAU_CC, ADAU_CC_WIDTH, ccr);

      }

    } else
      dsp.write(address, bytes_needed, reinterpret_cast<uint8_t*>(write_buffer));
  }

  void add_byte(uint8_t c) {
    *write_buffer_curr++ = c;
  }

  bool readline(char* buf) {
    // TODO(aselle): Check if we get exactly right characters
    //Serial.print("proc line... ");
    char* in = buf;
    int idx = 0;
    int full_byte = 0;
    bool error=false;
    while(*in != 0) {
      if(*in >= 'A' && *in <='F') full_byte += 0xa + ((*in)-'A');
      else if (*in >= '0' && *in <= '9') full_byte += ((*in)-'0');
      else {
        //Serial.print("Error ");
        //Serial.print(*in, HEX);
        //Serial.println("");
        error = true;
        break;
      }
      if(idx == 1) {
        idx = 0;
        //Serial.print(" 0x");
        //Serial.print(full_byte, HEX);
        *write_buffer_curr++ = full_byte;
        if(write_buffer_curr == end_buffer) return true;
        full_byte = 0;
      } else {
        idx = 1;
      }
      in++;
      full_byte = full_byte << 4;
    }

    //Serial.println(".");                                                                                                                                                                                                                                                                    
    return false;
  }
};

WriteBufferAccumulate write_buffer;

void handle_telnet_line(WiFiClient* client, char* line) {
  // TODO: state doesn't reset when connection is reset!
  static int read_state = 0;
  if(read_state == 1) {
    if(write_buffer.readline(line)) {
      read_state = 0;
      write_buffer.write();
      client->write("Wrote ");
      client->write(write_buffer.bytes());
      client->write(" bytes.\n");
    }
    return;
  }

  char* p = line;
  char* cmd = line;
  while(*p != 0 && *p != ' ') p++;
  char *args = *p == 0 ? p : p + 1;
  *p = 0;

  static uint8_t ada_buf[16];
    char sbuf[32];


  if(strcmp(cmd, "reset")==0) {
    Serial.print("Resetttitng ");    
    //pinMode(DSP_WP, INPUT);
    pinMode(DSP_RES, OUTPUT);
    //pinMode(DSP)
    //digitalWrite(DSP_RES, 0);
    delay(1000);
    //digitalWrite(DSP_RES, 1);
    pinMode(DSP_RES, INPUT);
  }   else if(strcmp(cmd, "dsp")==0) {
    parseJsonFileAndProgram(boot_json_file);
  }
  else if(strcmp(cmd, "amp")==0) {
    configureAmp();
  } else if (strcmp(cmd, "info")==0) {
    client->write("Probing i2c...\n");
    bool gotlcd = gen_i2c.probe(0x3c);
    sprintf(sbuf, "SH1106 LCD %s\n", gotlcd ? "detected": "" );
    client->write(sbuf);
    for(int k=0; k<4;k++) {
      bool gotit=gen_i2c.probe((0x38 + k));
      sprintf(sbuf, "ADAU1452 %d %s\n", k, gotit ? "detected" : "");
      client->write(sbuf);
    }
    for(int k=0; k<4;k++) {
      bool gotit=gen_i2c.probe((0x4c + k));
      sprintf(sbuf, "TAS5754M %d %s\n", k, gotit ? "detected" : "");
      client->write(sbuf);
    }
  } else if (strcmp(cmd, "r")==0) {
    size_t addr;
    if(sscanf(args, "0x%x", &addr) == 1) {
      uint8_t data[1], data2[1];
      tas.read(addr, 1, data);
      tas2.read(addr, 1, data2);
      sprintf(sbuf, "tas 0x%02x tas2 0x%02x\n", data[0], data2[0]);
      client->write(sbuf);
    
    }
  } else if (strcmp(cmd, "w")==0) {
    size_t addr, data;
    if(sscanf(args, "0x%x 0x%x", &addr, &data) == 2) {
      uint8_t databyte = data;
      tas.write(addr, 1, &databyte);
      tas2.write(addr, 1, &databyte);
    }
  } else if (strcmp(cmd, "wa")==0) {
    size_t addr, data, amp;
    if(sscanf(args, "0x%x %d 0x%x", &addr, &amp, &data) == 3) {
      uint8_t databyte = data;
      if(amp == 0) tas.write(addr, 1, &databyte);
      if(amp == 1) tas2.write(addr, 1, &databyte);
    }
  }else if (strcmp(cmd, "read")==0) {
    size_t addr, bytes;
    if(sscanf(args, "0x%x %d", &addr, &bytes) == 2) {
      Serial.print("Reading from addr ");
      Serial.print(addr);
      Serial.print(" bytes ");
      Serial.println(bytes);
      while(bytes > 0){
        int bytes_to_read = std::min(bytes, sizeof(ada_buf));
        dsp.read(addr, bytes_to_read, ada_buf);
        bytes -= bytes_to_read;
        addr += bytes_to_read;
        for(int k = 0; k < bytes_to_read; k++) {
          sprintf(sbuf, "%02x", ada_buf[k]);
          client->write(sbuf);
        }
        client->write("\n");
      }
    }
  } else if(strcmp(cmd, "write")==0) {
    size_t addr, bytes;
    int safe;
    if(sscanf(args, "%d 0x%x %d", &safe, &addr, &bytes) == 3) {
      read_state = 1;
      write_buffer.reset(safe, addr, bytes);
    } else {
      Serial.print("Failed to parse args on write '");
      Serial.println(args);
    }
  } else {
    Serial.print("Unknown line '");
    Serial.print(line);
    Serial.print("' cmd '");
    Serial.print(cmd);
    Serial.println("'");
  }
}


static char line_buffer[1024];
static char* curr = line_buffer;

void init_silly_telnet_server() {
  Serial.println("resetting telnet");
  curr = line_buffer;
}

void handle_silly_telnet_server(WiFiClient* client) {
  // TODO: state doesn't reset when connection is reset!


  if(client->available()){
    //get data from the telnet client and push it to the UART
    while(client->available()) {
      *curr = client->read();
      if(*curr == '\r') {}
      else if(*curr == '\n') {
        *curr = 0;
        handle_telnet_line(client, line_buffer);
        curr = line_buffer;
      } else {
        curr++;
      }
    }
  }
}

void handle_adau1701_tcpip_sigmastudio(WiFiClient* client) {
  bool adau1452 = true;
  enum States {
    IDLE,
    WRITE_HEADER,
    WRITE_BUFFER,
    READ_HEADER,
    READ_BUFFER
  };
  static States state = IDLE;
  static uint32_t counter = 0;
  static char header[16];
  static uint8_t read_back_buf[4096];
  static uint16_t addr;
  static uint16_t data_size;

  int header_size = adau1452 ? 13 : 9;

  while(client->available()) {
    // TODO(aselle): Inefficient one char at a time.
    uint8_t c = client->read();
    switch(state) {
      case IDLE:
        if (c == 0x09) {
          state = WRITE_HEADER;
          counter = 0;
          //Serial.printf("Reading write header\n", addr, data_size);
        } else if (c == 0x0a) {
          state = READ_HEADER;
          counter = 0;
          //Serial.printf("Reading read header\n", addr, data_size);
        } else {
          // TODO(aselle): Error?
        }
        break;
    case READ_HEADER:
      header[counter++] = c;
      if(counter >= header_size) {
        state = IDLE;
        counter = 0;
        if(adau1452) {
            data_size = (header[5] << 24) | (header[6] << 16) | (header[7] << 8 ) | header[8];
            addr =  (header[9] << 8)  | header[10];
        }
        dsp.read(addr, data_size, read_back_buf);
        Serial.printf("Reading addr0x %04x size 0x%04x\n", addr, data_size);
        client->write(0x0B);
        client->write(header, header_size);
        client->write(read_back_buf, data_size);
        

      }
    case WRITE_HEADER:
        header[counter++] = c;
        if(counter >= header_size) {
          state = WRITE_BUFFER;
          counter = 0;
          if(adau1452) {
            data_size = (header[7] << 24) | (header[8] << 16) | (header[9] << 8 ) | header[10];
            addr = (header[11] << 8)  | header[12];
          }else{
            data_size = (header[5] << 8) | header[6];
            addr = (header[7] << 8) | header[8];
          }
          write_buffer.reset(header[0] /* safe */, addr, data_size);
          Serial.printf("Writing DSP addr 0x%04x size 0x%04x\n", addr, data_size);
        }
        break;
    case WRITE_BUFFER:
        write_buffer.add_byte(c);
        counter++;
        if(counter >= data_size) {
          //Serial.printf("Emitting write\n", addr, data_size);
          write_buffer.write();
          state = IDLE;
        }
        break;
    }
  }
}

void handle_new_connections (WiFiServer* server_ptr, ClientHandler handler,void (*init_handler)()) {
    WiFiServer& server = *server_ptr;
    if (server.hasClient()){
      int i = 0;
      for(; i < MAX_SRV_CLIENTS; i++){
        //find free/disconnected spot
        if (!serverClients[i] || !serverClients[i].connected()){
          if(serverClients[i]) serverClients[i].stop();
          serverClients[i] = server.available();
          if (!serverClients[i]) Serial.println("available broken");
          Serial.print("New client: ");
          Serial.print(i); Serial.print(' ');
          Serial.println(serverClients[i].remoteIP());
          if(init_handler) init_handler();
          handlers[i] = handler;
          break;
        }
      }
      if (i >= MAX_SRV_CLIENTS) {
        //no free/disconnected spot so reject
        server.available().stop();
      }       
    }
}

// Handles cheapskate json files... barely
// Basically we just program thte all entires in "progs" section.
// We use a state machine. The main reason to do things This
// way is we only need to keep a bit of the file in memory,
// which is key.
struct JsonHandler : public JsonListener {
    uint32_t addr;
    uint32_t size;
    String data;
    String name;
    int inProgs = 0;
    bool started = false;
    bool is_delay = false;
    enum {NONE, ADDR, SIZE, DATA, NAME} mode;

    virtual void whitespace(char c) {}
  
    virtual void startDocument() {}

    virtual void key(String key) {
      if(key == "progs") inProgs++;
      if(inProgs > 0 && key == "0Name") mode=NAME;
      else if(key == "0Address") mode = ADDR;
      else if(key == "0Size") mode = SIZE;
      else if(key == "Data"){
        mode = DATA;
        inProgs++;
      }
      else mode = NONE;
    }

    // TODO: order dep on data being last!
    // TODO: error handling
    virtual void value(String value) {
      if(mode == ADDR) addr = value.toInt();
      else if(mode == SIZE) {
        size = value.toInt();
      }
      else if(mode == NAME) {
        const char* found_delay = strstr(value.c_str(), "Delay");
        is_delay = found_delay != NULL;
        Serial.print("Name ");
        Serial.print(value);
        Serial.print(" is delay ");
        Serial.println(is_delay ? "yes" : "no");
      }
      else if(mode == DATA) {
        auto conv_char = [](int c) {
          if(c >= 'A' && c <='F') return  0xa + (c-'A');
          else if(c >= 'a' && c <='f') return  0xa + (c-'a');
          else if (c >= '0' && c <= '9') return (c-'0');
          else return 0;
        };
        if(!started) {
          started = true;
          write_buffer.reset(0, addr, size);
        }
        write_buffer.add_byte((conv_char(value[0]) <<  4) | conv_char(value[1]));
      }
    }

    virtual void endArray() {
      inProgs--;
      if(inProgs <0) inProgs = 0;
      started = false;
    }

    virtual void endObject() {
      if(inProgs) {
        if (is_delay && addr==0x0) {
          Serial.write("Waiting for 500 ms\n");
          delay(200);
        } else {
          Serial.printf("About to write at 0x%x size 0x%x -- reamining 0x%x\n", addr, size, data.length(), write_buffer.bytes());
          write_buffer.write();
        }
      }
    }

    virtual void endDocument() {}

    virtual void startArray() {}

    virtual void startObject() {}
};

void parseJsonFileAndProgram(const char* filename) {
  Serial.printf("Parsing %s\n", filename);
  if(!SPIFFS.exists(filename)) {
    Serial.printf("File does nott exist '%s'.\n", filename);
    return;
  }
  File fp = SPIFFS.open(filename,"r");
  if(!fp) {
    Serial.printf("Failed to open '%s'\n", filename);
    return;
  }
  Serial.println("got filename.");
  JsonStreamingParser parser;
  JsonHandler handler;
  parser.setListener(&handler);
  int count = 0;
  while(fp.available()){
    count++;
    // Give wifi a chance to process
    if(count > 100) {
      yield();
      count=0;
    }
    // Character at a time, TODO(aselle): make it more robust
    int c = fp.read();
    parser.parse(c);
  }
}


void loop() 
{
  //volume.update();
  MDNS.update();
  webserver.handleClient();
  webserver_secure.handleClient();

  uint8_t i;
  if (wifiMulti.run() == WL_CONNECTED) {
    //check if there are any new clients
    handle_new_connections(&telnet_server, handle_silly_telnet_server, init_silly_telnet_server);
    handle_new_connections(&adau1701_server, handle_adau1701_tcpip_sigmastudio, nullptr);
    //check clients for data
    for(i = 0; i < MAX_SRV_CLIENTS; i++){
      if (serverClients[i] && serverClients[i].connected()){
        auto* handler = handlers[i];
        if(handler) handler(&serverClients[i]);
      }
      else {
        if (serverClients[i]) {
          serverClients[i].stop();
          handlers[i] = nullptr;
        }
      }
    }
  }
  else {
    Serial.println("WiFi not connected!");
    for(i = 0; i < MAX_SRV_CLIENTS; i++) {
      if (serverClients[i]) serverClients[i].stop();
    }
    delay(1000);
  }


}

void webServerHandleSend() {
    String pay = webserver.arg("plain");
    Serial.println(pay);
    webserver.send(200, "text/plain", "");   // Send HTTP status 200 (Ok) and send some text to the browser/client
    JsonStreamingParser parser;
    JsonHandler handler;
    parser.setListener(&handler);
    for(int i = 0; i < pay.length(); i++) parser.parse(pay[i]);
}

void webServerHandleUpload() {
  // TODO(aselle): Is this possible to thave contention here?
  static File uploadFP;
  const char* upload_file = boot_json_file;

  HTTPUpload& upload = webserver.upload();
  Serial.printf("webServerHandleUpload: In handle upload... %s uri %s\n", upload.name.c_str(), webserver.uri().c_str());
  switch(upload.status) {
    case UPLOAD_FILE_START:
      Serial.println("webServerHandleUpload: Starting upload...");
      uploadFP = SPIFFS.open(upload_file, "w");
      if(!uploadFP){
        Serial.printf("webServerHandleUpload: Failed to open '%s'\n", upload_file);
      }
      break;
    case UPLOAD_FILE_WRITE:
      if(uploadFP) {
        uploadFP.write(upload.buf, upload.currentSize);
      } else {
        Serial.println("webServerHandleUpload: Receiving upload with no open file!");
      }
      break;
    case UPLOAD_FILE_END:
      if(uploadFP){
        Serial.println("webServerHandleUpload: Finished receiving new file.");
        uploadFP.close();
        webserver.send(200);
        parseJsonFileAndProgram(upload_file);
      } else {
        Serial.println("webServerHandleUpload: Finished upload with no open file!");
        webserver.send(500, "text/plain", "file write error");
        // Reload the file.
      }
      break;
    case UPLOAD_FILE_ABORTED:
      Serial.println("webServerHandleUpload: Aborted receiving new file.");
      if(uploadFP) uploadFP.close();
      break;
  }
  yield();
}


#ifdef USE_ENCODER
void ICACHE_RAM_ATTR encoderISR()
{
  encoder_update_delay = 100;
  encoder.readAB();
}
#endif

void VolumeEncoder::updateVolume(int code) {
  // sent to amp
  uint8_t data = code;
  tas.write(0x3d, 1, &data);
  tas.write(0x3e, 1, &data);
  tas2.write(0x3d, 1, &data);
  tas2.write(0x3e, 1, &data);
  // write to display
  char buf[8];  
  if(dB == 255) {
    strcpy(buf, "-inf ");
  } else {
    sprintf(buf, "%5d", (48 - dB)/2);
  }
  u8g2.setFontMode(0);
  u8g2.setDrawColor(1);
  u8g2.setFont(FONT ); // choose a suitable font
  u8g2.setCursor(5,20);        // set write position
  u8g2.print(buf);     // write something to the internal memory
  u8g2.sendBuffer();  
}

void VolumeEncoder::begin() {
#ifdef USE_ENCODER
    attachInterrupt(digitalPinToInterrupt(ENCODER_PIN1),  encoderISR,  CHANGE); 
    attachInterrupt(digitalPinToInterrupt(ENCODER_PIN2),  encoderISR,  CHANGE); 
#endif
}
