import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const FEATURES = [
  {
    icon: "person-outline" as const,
    title: "Your Profile",
    desc: "Manage your membership info and household details",
  },
  {
    icon: "hand-left-outline" as const,
    title: "Prayer & Requests",
    desc: "Submit prayer requests and contact the pastoral team",
  },
  {
    icon: "people-outline" as const,
    title: "Members Directory",
    desc: "Connect with fellow CJC Church members",
  },
  {
    icon: "checkmark-circle-outline" as const,
    title: "Attendance",
    desc: "Track your attendance and check in for services",
  },
];

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const styles = makeStyles(colors, insets, isWeb);

  const openPortal = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const url = domain ? `https://${domain}/sign-in` : "https://cjcchurch.org/sign-in";
    await WebBrowser.openAuthSessionAsync(url, "church-mobile://");
  };

  const openConnect = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const url = domain ? `https://${domain}/connect` : "https://cjcchurch.org/connect";
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.logoSection}>
        <View style={styles.logoCircle}>
          <Ionicons name="shield-checkmark" size={40} color={colors.primary} />
        </View>
        <Text style={styles.appName}>Member Portal</Text>
        <Text style={styles.churchName}>CJC Church</Text>
        <Text style={styles.subtitle}>
          Sign in with your CJC Church account via Google or email — powered by
          Clerk, the same secure auth used on the web portal.
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.signInBtn, pressed && styles.pressed]}
        onPress={openPortal}
        testID="sign-in-button"
      >
        <Ionicons name="log-in-outline" size={20} color="#ffffff" />
        <Text style={styles.signInText}>Sign In with Clerk</Text>
      </Pressable>
      <View style={styles.authNote}>
        <Ionicons name="logo-google" size={14} color={colors.mutedForeground} />
        <Text style={styles.authNoteText}>Google SSO · Email · Password</Text>
      </View>

      <Text style={styles.sectionTitle}>What's in the portal</Text>

      {FEATURES.map((feature) => (
        <View key={feature.icon} style={styles.featureRow}>
          <View style={styles.featureIcon}>
            <Ionicons name={feature.icon} size={20} color={colors.primary} />
          </View>
          <View style={styles.featureInfo}>
            <Text style={styles.featureTitle}>{feature.title}</Text>
            <Text style={styles.featureDesc}>{feature.desc}</Text>
          </View>
        </View>
      ))}

      <View style={styles.divider} />

      <View style={styles.newMember}>
        <Text style={styles.newMemberText}>New to CJC Church?</Text>
        <Pressable
          style={({ pressed }) => [styles.connectBtn, pressed && styles.pressed]}
          onPress={openConnect}
          testID="connect-button"
        >
          <Text style={styles.connectBtnText}>Fill Out a Connect Card</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: { top: number; bottom: number }, isWeb: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingTop: isWeb ? 67 + 16 : 16,
      paddingBottom: isWeb ? 34 + 80 : insets.bottom + 80,
      paddingHorizontal: 20,
    },
    logoSection: {
      alignItems: "center",
      marginBottom: 28,
      paddingTop: 8,
    },
    logoCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      borderWidth: 2,
      borderColor: colors.border,
    },
    appName: {
      fontSize: 26,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 2,
    },
    churchName: {
      fontSize: 15,
      fontWeight: "500" as const,
      fontFamily: "Inter_500Medium",
      color: colors.primary,
      marginBottom: 12,
    },
    subtitle: {
      fontSize: 15,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      lineHeight: 22,
      maxWidth: 300,
    },
    signInBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: colors.radius,
      gap: 8,
      marginBottom: 28,
    },
    signInText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
    },
    pressed: {
      opacity: 0.75,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 14,
    },
    featureRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 14,
    },
    featureIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    featureInfo: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 15,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 2,
    },
    featureDesc: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      lineHeight: 18,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 24,
    },
    newMember: {
      alignItems: "center",
      gap: 12,
    },
    newMemberText: {
      fontSize: 15,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    connectBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.muted,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
    },
    connectBtnText: {
      fontSize: 15,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
    },
    authNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: -16,
      marginBottom: 24,
      justifyContent: "center",
    },
    authNoteText: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
  });
}
