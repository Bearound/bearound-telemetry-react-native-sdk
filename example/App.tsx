import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  AppState,
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
const MAX_LOG = 500;

/** One observed detection (a fresh advertisement processed by the SDK). */
interface LogEntry {
  id: string;
  ts: number;
  major: number;
  minor: number;
  rssi: number;
  source: 'BEAD' | 'iBeacon';
  isBackground: boolean;
}

interface MinuteGroup {
  minute: number;
  total: number;
  fg: number;
  bg: number;
  uniqueBeacons: number;
}

const two = (v: number) => String(v).padStart(2, '0');
const fmtTime = (ts: number) => {
  const d = new Date(ts);
  return `${two(d.getDate())}/${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(
    d.getMinutes(),
  )}:${two(d.getSeconds())}`;
};
const fmtMinute = (ts: number) => {
  const d = new Date(ts);
  return `${two(d.getDate())}/${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(
    d.getMinutes(),
  )}`;
};

export default function App() {
  const beaconsRef = useRef(new Map<string, TelemetryBeacon>());
  const lastLoggedRef = useRef(new Map<string, number>());
  const isBackgroundRef = useRef(false);
  const idRef = useRef(0);

  const [beacons, setBeacons] = useState<TelemetryBeacon[]>([]);
  const [collecting, setCollecting] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'beacons' | 'log'>('beacons');
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [fgLog, setFgLog] = useState<LogEntry[]>([]);
  const [bgLog, setBgLog] = useState<LogEntry[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', state => {
      isBackgroundRef.current = state !== 'active';
    });
    const sub = BearoundTelemetry.onBeacons(list => {
      const fresh: LogEntry[] = [];
      for (const b of list) {
        const key = `${b.major}/${b.minor}`;
        beaconsRef.current.set(key, b);
        // Log only FRESH observations: the event re-emits the whole list on
        // every delivery, so an entry is recorded only when lastSeen advanced.
        if (lastLoggedRef.current.get(key) !== b.lastSeen) {
          lastLoggedRef.current.set(key, b.lastSeen);
          fresh.push({
            id: String(idRef.current++),
            ts: Date.now(),
            major: b.major,
            minor: b.minor,
            rssi: b.rssi,
            source: b.battery != null ? 'BEAD' : 'iBeacon',
            isBackground: isBackgroundRef.current,
          });
        }
      }
      setBeacons([...beaconsRef.current.values()]);
      if (fresh.length > 0) {
        if (isBackgroundRef.current) {
          setBgLog(prev => [...fresh, ...prev].slice(0, MAX_LOG));
        } else {
          setFgLog(prev => [...fresh, ...prev].slice(0, MAX_LOG));
        }
      }
    });
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => {
      sub.remove();
      appStateSub.remove();
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

  const togglePin = useCallback((key: string) => {
    setPinned(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const sorted = [...beacons].sort((a, b) => {
    const ap = pinned.has(`${a.major}/${a.minor}`) ? 0 : 1;
    const bp = pinned.has(`${b.major}/${b.minor}`) ? 0 : 1;
    if (ap !== bp) {
      return ap - bp;
    }
    return a.minor - b.minor;
  });

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F6FA" />
      <Text style={styles.title}>Bearound Telemetry</Text>
      <View style={styles.body}>
        {tab === 'beacons' ? (
          <BeaconsPage
            beacons={sorted}
            pinned={pinned}
            collecting={collecting}
            handoff={handoff}
            error={error}
            onStart={start}
            onStop={stop}
            onTogglePin={togglePin}
          />
        ) : (
          <LogPage
            fgLog={fgLog}
            bgLog={bgLog}
            onClear={() => {
              setFgLog([]);
              setBgLog([]);
            }}
          />
        )}
      </View>
      <View style={styles.tabBar}>
        <Pressable
          style={styles.tabItem}
          onPress={() => setTab('beacons')}>
          <Text
            style={[styles.tabLabel, tab === 'beacons' && styles.tabActive]}>
            Beacons
          </Text>
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => setTab('log')}>
          <Text style={[styles.tabLabel, tab === 'log' && styles.tabActive]}>
            Log
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// =============================================================================
// Beacons tab
// =============================================================================

function BeaconsPage({
  beacons,
  pinned,
  collecting,
  handoff,
  error,
  onStart,
  onStop,
  onTogglePin,
}: {
  beacons: TelemetryBeacon[];
  pinned: Set<string>;
  collecting: boolean;
  handoff: boolean;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  onTogglePin: (key: string) => void;
}) {
  return (
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
                style={[styles.status, {color: collecting ? BLUE : '#8A8F98'}]}>
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
                onPress={onStart}
                disabled={collecting}
                style={[styles.button, collecting && styles.buttonDisabled]}>
                <Text style={styles.buttonText}>Iniciar coleta</Text>
              </Pressable>
              <Pressable
                onPress={onStop}
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
      renderItem={({item}) => (
        <BeaconCard
          beacon={item}
          isPinned={pinned.has(`${item.major}/${item.minor}`)}
          onPress={() => onTogglePin(`${item.major}/${item.minor}`)}
        />
      )}
    />
  );
}

function BeaconCard({
  beacon,
  isPinned,
  onPress,
}: {
  beacon: TelemetryBeacon;
  isPinned: boolean;
  onPress: () => void;
}) {
  const age = Math.max(0, Math.round((Date.now() - beacon.lastSeen) / 1000));
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.rowBetween}>
        <View style={styles.rowCenter}>
          <Text style={styles.cardTitle}>
            Beacon {beacon.major}.{beacon.minor}
          </Text>
          {isPinned && <Text style={styles.pin}> 📌</Text>}
        </View>
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
    </Pressable>
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

// =============================================================================
// Log tab — detailed entries + per-minute detection counts
// =============================================================================

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: {key: T; label: string}[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map(opt => (
        <Pressable
          key={opt.key}
          onPress={() => onChange(opt.key)}
          style={[
            styles.segmentedItem,
            value === opt.key && styles.segmentedActive,
          ]}>
          <Text
            style={[
              styles.segmentedLabel,
              value === opt.key && styles.segmentedLabelActive,
            ]}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function Badge({text, color}: {text: string; color: string}) {
  return (
    <View style={[styles.badge, {backgroundColor: color}]}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

function LogPage({
  fgLog,
  bgLog,
  onClear,
}: {
  fgLog: LogEntry[];
  bgLog: LogEntry[];
  onClear: () => void;
}) {
  const [view, setView] = useState<'detail' | 'grouped'>('detail');
  const [mode, setMode] = useState<'all' | 'fg' | 'bg'>('all');
  const [type, setType] = useState<'all' | 'bead' | 'ibeacon'>('all');

  const source =
    mode === 'all'
      ? [...fgLog, ...bgLog].sort((a, b) => b.ts - a.ts)
      : mode === 'fg'
        ? fgLog
        : bgLog;
  const filtered = source.filter(e =>
    type === 'all'
      ? true
      : type === 'bead'
        ? e.source === 'BEAD'
        : e.source === 'iBeacon',
  );

  const groupsMap = new Map<number, LogEntry[]>();
  for (const e of filtered) {
    const d = new Date(e.ts);
    d.setSeconds(0, 0);
    const key = d.getTime();
    const arr = groupsMap.get(key);
    if (arr) {
      arr.push(e);
    } else {
      groupsMap.set(key, [e]);
    }
  }
  const groups: MinuteGroup[] = [...groupsMap.entries()]
    .map(([minute, entries]) => ({
      minute,
      total: entries.length,
      fg: entries.filter(e => !e.isBackground).length,
      bg: entries.filter(e => e.isBackground).length,
      uniqueBeacons: new Set(entries.map(e => `${e.major}.${e.minor}`)).size,
    }))
    .sort((a, b) => b.minute - a.minute);

  return (
    <View style={styles.logRoot}>
      <Segmented
        options={[
          {key: 'detail', label: 'Detalhado'},
          {key: 'grouped', label: 'Por Minuto'},
        ]}
        value={view}
        onChange={setView}
      />
      <Segmented
        options={[
          {key: 'all', label: 'Tudo'},
          {key: 'fg', label: 'FG'},
          {key: 'bg', label: 'BG'},
        ]}
        value={mode}
        onChange={setMode}
      />
      <Segmented
        options={[
          {key: 'all', label: 'Tudo'},
          {key: 'bead', label: 'BEAD'},
          {key: 'ibeacon', label: 'iBeacon'},
        ]}
        value={type}
        onChange={setType}
      />
      <View style={styles.rowBetween}>
        <Text style={styles.logCounts}>
          FG:{fgLog.length} BG:{bgLog.length}
        </Text>
        <Pressable onPress={onClear}>
          <Text style={styles.clear}>Limpar</Text>
        </Pressable>
      </View>
      {filtered.length === 0 ? (
        <View style={styles.logEmpty}>
          <Text style={styles.empty}>Nenhuma detecção registrada</Text>
        </View>
      ) : view === 'grouped' ? (
        <FlatList
          data={groups}
          keyExtractor={g => String(g.minute)}
          renderItem={({item}) => (
            <View style={styles.logRow}>
              <View style={styles.rowBetween}>
                <Text style={styles.logRowTitle}>{fmtMinute(item.minute)}</Text>
                <Text style={styles.logRowCount}>
                  {item.total} detecções
                </Text>
              </View>
              <View style={styles.rowBetween}>
                <View style={styles.rowCenter}>
                  {item.fg > 0 && <Badge text={`FG ${item.fg}`} color="#4CAF50" />}
                  {item.bg > 0 && (
                    <View style={styles.badgeGap}>
                      <Badge text={`BG ${item.bg}`} color="#FF9800" />
                    </View>
                  )}
                </View>
                <Text style={styles.logCounts}>
                  {item.uniqueBeacons} beacon{item.uniqueBeacons === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={e => e.id}
          renderItem={({item}) => (
            <View style={styles.logRow}>
              <View style={styles.rowBetween}>
                <Text style={styles.logRowTitle}>
                  {item.major}.{item.minor}
                </Text>
                <Text style={styles.logCounts}>{fmtTime(item.ts)}</Text>
              </View>
              <View style={styles.rowCenter}>
                <Text style={styles.logCounts}>RSSI: {item.rssi} </Text>
                <Badge
                  text={item.source}
                  color={item.source === 'BEAD' ? '#9C27B0' : '#3F51B5'}
                />
                <View style={styles.badgeGap}>
                  <Badge
                    text={item.isBackground ? 'BG' : 'FG'}
                    color={item.isBackground ? '#FF9800' : '#4CAF50'}
                  />
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#F4F6FA'},
  body: {flex: 1},
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
  rowCenter: {flexDirection: 'row', alignItems: 'center'},
  cardTitle: {fontSize: 16, fontWeight: 'bold', color: '#1A1C1E'},
  pin: {fontSize: 13},
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8EAED',
  },
  tabItem: {flex: 1, paddingVertical: 12, alignItems: 'center'},
  tabLabel: {fontSize: 14, color: '#8A8F98', fontWeight: '600'},
  tabActive: {color: BLUE},
  logRoot: {flex: 1, paddingHorizontal: 16, gap: 8},
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#C4C7CC',
    borderRadius: 20,
    overflow: 'hidden',
  },
  segmentedItem: {flex: 1, paddingVertical: 7, alignItems: 'center'},
  segmentedActive: {backgroundColor: '#D6E5FA'},
  segmentedLabel: {fontSize: 12, color: '#44474E'},
  segmentedLabelActive: {color: '#0B3D75', fontWeight: '600'},
  logCounts: {fontSize: 12, color: '#8A8F98'},
  clear: {fontSize: 12, color: BLUE, fontWeight: '600', paddingVertical: 4},
  logEmpty: {flex: 1, justifyContent: 'center'},
  logRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
    gap: 4,
  },
  logRowTitle: {fontWeight: '600', color: '#1A1C1E'},
  logRowCount: {fontWeight: 'bold', color: '#1A1C1E'},
  badge: {
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: {fontSize: 10, color: '#FFFFFF', fontWeight: '500'},
  badgeGap: {marginLeft: 6},
});
