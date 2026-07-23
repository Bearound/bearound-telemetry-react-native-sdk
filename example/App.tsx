import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  FlatList,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import BearoundTelemetry, {
  TelemetryBeacon,
} from '@bearound/telemetry-react-native-sdk';

// Public test token (same fallback as the native samples). Real apps load it
// from secure config — never hardcode production tokens.
const BUSINESS_TOKEN = 'ee2ec9c46d2b2ad99bddcdd0afe224e6';

const BLUE = '#0066CC';

export default function App() {
  const beaconsRef = useRef(new Map<string, TelemetryBeacon>());
  const [beacons, setBeacons] = useState<TelemetryBeacon[]>([]);
  const [collecting, setCollecting] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const sub = BearoundTelemetry.onBeacons(list => {
      for (const b of list) {
        beaconsRef.current.set(`${b.major}/${b.minor}`, b);
      }
      setBeacons(
        [...beaconsRef.current.values()].sort((a, b) => a.minor - b.minor),
      );
    });
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      if (Platform.OS === 'android' && Platform.Version >= 31) {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        );
        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
          setError('Permissão de dispositivos por perto negada.');
          return;
        }
      }
      const companion = await BearoundTelemetry.configure(BUSINESS_TOKEN);
      await BearoundTelemetry.startScanning();
      setHandoff(companion);
      setCollecting(true);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      await BearoundTelemetry.stopScanning();
      setCollecting(false);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F6FA" />
      <Text style={styles.title}>Bearound Telemetry</Text>
      <FlatList
        contentContainerStyle={styles.list}
        data={beacons}
        keyExtractor={b => `${b.major}/${b.minor}`}
        ListHeaderComponent={
          <>
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                Saúde da frota de beacons: bateria, temperatura, movimento e
                sinal. Este SDK não faz rastreio de pessoas.
              </Text>
            </View>
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Coleta</Text>
                <Text
                  style={[
                    styles.status,
                    {color: collecting ? BLUE : '#8A8F98'},
                  ]}>
                  {collecting ? 'Coletando' : 'Parada'}
                </Text>
              </View>
              {collecting && (
                <Text style={styles.mode}>
                  {handoff
                    ? 'Modo companion (handoff do rastreio)'
                    : 'Modo standalone'}
                </Text>
              )}
              {error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.buttons}>
                <Pressable
                  onPress={start}
                  disabled={collecting}
                  style={[styles.button, collecting && styles.buttonDisabled]}>
                  <Text style={styles.buttonText}>Iniciar coleta</Text>
                </Pressable>
                <Pressable
                  onPress={stop}
                  disabled={!collecting}
                  style={[
                    styles.buttonOutline,
                    !collecting && styles.buttonDisabled,
                  ]}>
                  <Text style={styles.buttonOutlineText}>Parar</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.section}>
              Telemetria dos beacons ({beacons.length})
            </Text>
            {beacons.length === 0 && (
              <View style={styles.card}>
                <Text style={styles.empty}>Nenhum beacon detectado ainda.</Text>
              </View>
            )}
          </>
        }
        renderItem={({item}) => <BeaconCard beacon={item} />}
      />
    </SafeAreaView>
  );
}

function BeaconCard({beacon}: {beacon: TelemetryBeacon}) {
  const age = Math.max(0, Math.round((Date.now() - beacon.lastSeen) / 1000));
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>
          Beacon {beacon.major}.{beacon.minor}
        </Text>
        <Text style={styles.age}>há {age}s</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.metrics}>
        <Metric
          value={beacon.battery != null ? `${beacon.battery} mV` : '—'}
          label="Bateria"
        />
        <Metric
          value={beacon.temperature != null ? `${beacon.temperature} °C` : '—'}
          label="Temperatura"
        />
        <Metric value={beacon.movements?.toString() ?? '—'} label="Movimentos" />
      </View>
      <View style={styles.metrics}>
        <Metric value={`${beacon.rssi} dB`} label="Sinal" />
        <Metric value={beacon.firmware ?? '—'} label="Firmware" />
        <View style={styles.metric} />
      </View>
    </View>
  );
}

function Metric({value, label}: {value: string; label: string}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#F4F6FA'},
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 14,
    color: '#1A1C1E',
  },
  list: {paddingHorizontal: 16, paddingBottom: 24},
  banner: {
    backgroundColor: '#D6E5FA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  bannerText: {fontSize: 12, color: '#0B3D75', lineHeight: 17},
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {fontSize: 16, fontWeight: 'bold', color: '#1A1C1E'},
  status: {fontWeight: '600'},
  mode: {fontSize: 12, color: '#44474E', marginTop: 4},
  error: {fontSize: 12, color: '#B3261E', marginTop: 6},
  buttons: {flexDirection: 'row', marginTop: 14, gap: 12},
  button: {
    flex: 1,
    backgroundColor: BLUE,
    borderRadius: 24,
    paddingVertical: 11,
    alignItems: 'center',
  },
  buttonText: {color: '#FFFFFF', fontWeight: '600'},
  buttonOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: BLUE,
    borderRadius: 24,
    paddingVertical: 11,
    alignItems: 'center',
  },
  buttonOutlineText: {color: BLUE, fontWeight: '600'},
  buttonDisabled: {opacity: 0.4},
  section: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
    marginBottom: 8,
    color: '#1A1C1E',
  },
  empty: {textAlign: 'center', color: '#44474E', paddingVertical: 8},
  age: {fontSize: 12, color: '#8A8F98'},
  divider: {height: 1, backgroundColor: '#E8EAED', marginVertical: 12},
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  metric: {flex: 1, alignItems: 'center'},
  metricValue: {fontWeight: 'bold', color: '#1A1C1E'},
  metricLabel: {fontSize: 11, color: '#8A8F98', marginTop: 2},
});
