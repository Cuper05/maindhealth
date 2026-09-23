using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net;
using System.Text;
using System.Threading;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.GenericAttributeProfile;
using Windows.Storage.Streams;

class Sample {
  public double Celsius;
  public long Stamp;
  public int Order;
}

class Ft95Bridge {
  static readonly int Port = GetInt("FT95_PORT", 3933);
  static readonly ulong Address = Convert.ToUInt64(
    Environment.GetEnvironmentVariable("FT95_ADDRESS") ?? "FF0000000B4E", 16);
  static readonly object Gate = new object();
  static string progress = "Listo. Mida en la frente y pulse SCAN.";
  static int readBusy;

  static int GetInt(string name, int fallback) {
    int n;
    return int.TryParse(Environment.GetEnvironmentVariable(name), out n) ? n : fallback;
  }

  static T Wait<T>(Windows.Foundation.IAsyncOperation<T> op, int ms) {
    var wh = new ManualResetEvent(false);
    T local = default(T);
    op.Completed = (info, status) => {
      try {
        if (status == Windows.Foundation.AsyncStatus.Completed) local = info.GetResults();
      } catch {
        /* el caller ve null */
      }
      wh.Set();
    };
    wh.WaitOne(ms);
    return local;
  }

  static double? MedFloat(byte[] b, int o) {
    if (b == null || b.Length < o + 4) return null;
    int mant = b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
    if ((mant & 0x800000) != 0) mant -= 0x1000000;
    int exp = (sbyte)b[o + 3];
    if (mant == 0x7FFFFF || mant == -0x800000) return null;
    return mant * Math.Pow(10, exp);
  }

  static long StampOf(byte[] b) {
    if (b == null || b.Length < 12 || (b[0] & 0x02) == 0) return 0;
    int year = b[5] | (b[6] << 8);
    return ((long)year << 40) | ((long)b[7] << 32) | ((long)b[8] << 24) |
           ((long)b[9] << 16) | ((long)b[10] << 8) | b[11];
  }

  static void Note(byte[] b, List<Sample> list, ref int order) {
    if (b == null || b.Length < 5) return;
    double? raw = MedFloat(b, 1);
    if (raw == null) return;
    double c = (b[0] & 0x01) != 0 ? (raw.Value - 32.0) * 5.0 / 9.0 : raw.Value;
    if (c < 30 || c > 45) return;
    lock (list) {
      list.Add(new Sample { Celsius = c, Stamp = StampOf(b), Order = order++ });
    }
  }

  static Sample Newest(List<Sample> list) {
    Sample best = null;
    foreach (var s in list) {
      if (best == null || s.Stamp > best.Stamp || (s.Stamp == best.Stamp && s.Order > best.Order))
        best = s;
    }
    return best;
  }

  static void CloseBle(IDisposable item) {
    if (item == null) return;
    try { item.Dispose(); } catch { }
  }

  static string ReadTemperature(out string error) {
    error = null;
    progress = "Buscando el termómetro FT95…";
    BluetoothLEDevice dev = null;
    GattDeviceService svc = null;
    GattCharacteristic temp = null;
    try {
      dev = Wait(BluetoothLEDevice.FromBluetoothAddressAsync(Address), 8000);
      if (dev == null) {
        error = "No se encontró el FT95. Mida en la frente con SCAN y deje parpadear el Bluetooth.";
        progress = error;
        return null;
      }
      progress = "Conectando al FT95. Deje parpadear el Bluetooth.";
      var sv = Wait(dev.GetGattServicesForUuidAsync(
        new Guid("00001809-0000-1000-8000-00805f9b34fb"), BluetoothCacheMode.Uncached), 8000);
      if (sv == null || sv.Services == null || sv.Services.Count == 0) {
        error = "El FT95 no respondió. Mida en la frente con SCAN y no lo apague.";
        progress = error;
        return null;
      }
      svc = sv.Services[0];
      var chs = Wait(svc.GetCharacteristicsAsync(BluetoothCacheMode.Uncached), 6000);
      if (chs != null) {
        foreach (var c in chs.Characteristics) {
          if (c.Uuid.ToString().IndexOf("2a1c", StringComparison.OrdinalIgnoreCase) >= 0) temp = c;
        }
      }
      if (temp == null) {
        error = "El FT95 no tiene la medición de temperatura.";
        progress = error;
        return null;
      }
      var list = new List<Sample>();
      int order = 0;
      temp.ValueChanged += (sender, args) => {
        var reader = DataReader.FromBuffer(args.CharacteristicValue);
        var bytes = new byte[args.CharacteristicValue.Length];
        reader.ReadBytes(bytes);
        Note(bytes, list, ref order);
        progress = "Recibiendo temperatura del FT95…";
      };
      progress = "Apunte a la frente y pulse SCAN si aún no midió.";
      var cccd = Wait(temp.WriteClientCharacteristicConfigurationDescriptorAsync(
        GattClientCharacteristicConfigurationDescriptorValue.Indicate), 6000);
      if (cccd != GattCommunicationStatus.Success) {
        error = "No se pudo suscribir al FT95. Si pide un PIN, emparéjelo de nuevo.";
        progress = error;
        return null;
      }
      var started = DateTime.UtcNow;
      int seen = 0;
      var lastGrowth = DateTime.UtcNow;
      while ((DateTime.UtcNow - started).TotalSeconds < 25) {
        Thread.Sleep(200);
        int n;
        lock (list) n = list.Count;
        if (n > seen) {
          seen = n;
          lastGrowth = DateTime.UtcNow;
        } else if (seen > 0 && (DateTime.UtcNow - lastGrowth).TotalMilliseconds > 1200) {
          break;
        }
      }
      var best = Newest(list);
      if (best == null) {
        error = "El FT95 no envió temperatura. Mida en la frente con SCAN y deje parpadear el Bluetooth.";
        progress = error;
        return null;
      }
      string value = best.Celsius.ToString("0.0", CultureInfo.InvariantCulture);
      progress = value + " °C";
      return value;
    } finally {
      if (temp != null) {
        try {
          Wait(temp.WriteClientCharacteristicConfigurationDescriptorAsync(
            GattClientCharacteristicConfigurationDescriptorValue.None), 1500);
        } catch { }
      }
      CloseBle(svc);
      CloseBle(dev);
    }
  }

  static void Send(HttpListenerResponse res, int code, string json) {
    byte[] buf = Encoding.UTF8.GetBytes(json);
    res.StatusCode = code;
    res.ContentType = "application/json";
    res.Headers.Add("Access-Control-Allow-Origin", "*");
    res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.Headers.Add("Access-Control-Allow-Headers", "Content-Type");
    res.ContentLength64 = buf.Length;
    res.OutputStream.Write(buf, 0, buf.Length);
    res.Close();
  }

  static void Main() {
    var listener = new HttpListener();
    listener.Prefixes.Add("http://127.0.0.1:" + Port + "/");
    listener.Start();
    Console.WriteLine("[ft95-bridge] http://127.0.0.1:" + Port);
    while (listener.IsListening) {
      HttpListenerContext ctx;
      try { ctx = listener.GetContext(); }
      catch { break; }
      var req = ctx.Request;
      var res = ctx.Response;
      string path = req.Url.AbsolutePath;
      if (req.HttpMethod == "OPTIONS") { Send(res, 204, ""); continue; }
      if (req.HttpMethod == "GET" && path == "/health") {
        bool paired = false;
        BluetoothLEDevice dev = null;
        try {
          dev = Wait(BluetoothLEDevice.FromBluetoothAddressAsync(Address), 2500);
          paired = dev != null && dev.DeviceInformation.Pairing.IsPaired;
        } catch { }
        finally { CloseBle(dev); }
        Send(res, 200, "{\"ok\":true,\"device\":\"ft95\",\"address\":\"" +
          Address.ToString("X12") + "\",\"paired\":" + (paired ? "true" : "false") + "}");
        continue;
      }
      if (req.HttpMethod == "GET" && path == "/progress") {
        Send(res, 200, "{\"message\":\"" + progress.Replace("\"", "'") + "\"}");
        continue;
      }
      if (req.HttpMethod == "POST" && path == "/read") {
        if (Interlocked.Exchange(ref readBusy, 1) == 1) {
          Send(res, 409, "{\"ok\":false,\"error\":\"Ya hay una lectura en curso.\"}");
          continue;
        }
        try {
          string err;
          string temp = ReadTemperature(out err);
          if (temp == null) Send(res, 500, "{\"ok\":false,\"error\":\"" + (err ?? "Sin lectura").Replace("\"", "'") + "\"}");
          else Send(res, 200, "{\"ok\":true,\"temperature\":" + temp + ",\"connected\":true}");
        } finally {
          Interlocked.Exchange(ref readBusy, 0);
        }
        continue;
      }
      Send(res, 404, "{\"ok\":false,\"error\":\"Not found\"}");
    }
  }
}
