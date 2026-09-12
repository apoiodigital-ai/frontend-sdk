import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CaneSDK, CaneSDKHost } from '@apoiocane/react-native-sdk';
import {
  installMockBackend,
  MOCK_BASE_URL,
  DEMO_TARGET_VIEW_ID,
} from './mockBackend';

// The mock backend is wired up before anything else in this example so
// CaneSDK's real ApiClient (plain `fetch`, no mocking inside the library
// itself) has something to talk to. A real partner app would simply point
// `options.baseUrl` at their actual ApoioDigital backend deployment instead.
installMockBackend();

type Screen = 'home' | 'payment';

export default function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('home');

  useEffect(() => {
    CaneSDK.init({
      accessKey: 'demo-access-key',
      options: {
        voiceGuidance: true,
        hapticFeedback: true,
        // Shortened purely so this demo is easy to see in a couple of
        // seconds. Production integrations should leave this as 'auto' (or
        // pass real min/max bounds) -- see README "Inactivity heuristic".
        inactivityTimeout: { min: 5000, max: 10000 },
        baseUrl: MOCK_BASE_URL,
      },
    });

    // In a real app this would be an anonymized hash the partner already
    // has, supplied after their own login -- CaneSDK never sees real PII.
    CaneSDK.registerUser({ userId: 'demo-user-hash-000' });

    return () => {
      CaneSDK.destroy();
    };
  }, []);

  return (
    <CaneSDKHost>
      <SafeAreaView style={styles.safe}>
        {screen === 'home' ? (
          <HomeScreen onGoToPayment={() => setScreen('payment')} />
        ) : (
          <PaymentScreen onGoBack={() => setScreen('home')} />
        )}
      </SafeAreaView>
    </CaneSDKHost>
  );
}

function HomeScreen({
  onGoToPayment,
}: {
  onGoToPayment: () => void;
}): React.JSX.Element {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Cane SDK - App de exemplo</Text>
      <Text style={styles.paragraph}>
        Esta tela NÃO é crítica: a heurística de inatividade não está armada
        aqui. Toque no botão de ajuda (canto inferior direito) a qualquer
        momento para acionar o fluxo de assistência sob demanda.
      </Text>
      <TouchableOpacity style={styles.primaryButton} onPress={onGoToPayment}>
        <Text style={styles.primaryButtonText}>Ir para Pagamento</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function PaymentScreen({
  onGoBack,
}: {
  onGoBack: () => void;
}): React.JSX.Element {
  useEffect(() => {
    // Marks this screen as high-stakes: runs the local, on-device scan
    // ONCE and arms the inactivity heuristic. See README "Inactivity
    // heuristic" for exactly what does (and does not) happen here.
    CaneSDK.registerCriticalScreen({ name: 'payment-confirmation' });
    return () => {
      CaneSDK.unregisterCriticalScreen();
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Confirmar Pagamento</Text>
      <Text style={styles.paragraph}>
        Esta tela É crítica. Se você ficar parado sem tocar em nada por um tempo
        (calculado a partir do que está na tela), o Cane SDK vai perguntar
        discretamente se você precisa de ajuda -- nada é enviado a nenhum
        servidor antes disso.
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>Valor</Text>
        <Text style={styles.value}>R$ 128,50</Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Beneficiário</Text>
        <Text style={styles.value}>Farmácia Bem-Estar</Text>
      </View>

      {/*
        `accessibilityLabel` doubles as the stable identifier the native
        scanner reports as `viewId` (see the Android/iOS scanner's id
        priority order in the README). The example's mock backend resolves
        its `achar-resposta` answer to this exact id, so the spotlight in a
        real on-device run would highlight this button.
      */}
      <TouchableOpacity
        style={styles.payButton}
        accessibilityLabel={DEMO_TARGET_VIEW_ID}
        onPress={() => {}}
      >
        <Text style={styles.payButtonText}>Confirmar pagamento</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={onGoBack}>
        <Text style={styles.secondaryButtonText}>Voltar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7' },
  container: { flexGrow: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12, color: '#111' },
  paragraph: { fontSize: 15, lineHeight: 22, color: '#444', marginBottom: 24 },
  primaryButton: {
    backgroundColor: '#1F6FEB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  field: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  label: { fontSize: 13, color: '#888', marginBottom: 4 },
  value: { fontSize: 18, fontWeight: '600', color: '#111' },
  payButton: {
    backgroundColor: '#1E8E3E',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  payButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  secondaryButton: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#1F6FEB', fontSize: 16, fontWeight: '600' },
});
