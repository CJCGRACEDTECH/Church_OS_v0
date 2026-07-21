import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
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

const CJC_YOUTUBE_CHANNEL = "https://www.youtube.com/@CJCChurch";

const SERVICE_TIMES = [
  { day: "Thursday", time: "7:00 PM", label: "Bible Study", icon: "book-outline" as const },
  { day: "Friday", time: "7:00 PM", label: "Prayer Night", icon: "radio-button-on-outline" as const },
  { day: "Saturday", time: "6:00 PM", label: "Evening Service", icon: "moon-outline" as const },
  { day: "Sunday", time: "11:00 AM", label: "Main Service", icon: "sunny-outline" as const },
];

const QUICK_LINKS = [
  { label: "Watch Live", icon: "play-circle-outline" as const, color: "#ef4444" },
  { label: "Give Online", icon: "heart-outline" as const, color: "#2563eb" },
  { label: "Connect Card", icon: "person-add-outline" as const, color: "#059669" },
  { label: "Prayer Request", icon: "hand-left-outline" as const, color: "#7c3aed" },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const styles = makeStyles(colors, insets, isWeb);

  const openYouTube = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(CJC_YOUTUBE_CHANNEL);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={["#181d2e", "#1e2a4a"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroBanner}
      >
        <Text style={styles.heroGreeting}>Welcome to</Text>
        <Text style={styles.heroChurchName}>CJC Church</Text>
        <Text style={styles.heroTagline}>Christ Jesus Centered</Text>
        <Pressable
          style={({ pressed }) => [styles.liveBtn, pressed && { opacity: 0.8 }]}
          onPress={openYouTube}
          testID="watch-live-button"
        >
          <View style={styles.liveDot} />
          <Text style={styles.liveBtnText}>Watch on YouTube</Text>
        </Pressable>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Service Times</Text>
        <View style={styles.serviceGrid}>
          {SERVICE_TIMES.map((service) => (
            <View key={service.day} style={styles.serviceCard}>
              <View style={styles.serviceIconWrap}>
                <Ionicons name={service.icon} size={20} color={colors.primary} />
              </View>
              <Text style={styles.serviceDay}>{service.day}</Text>
              <Text style={styles.serviceTime}>{service.time}</Text>
              <Text style={styles.serviceLabel}>{service.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Access</Text>
        <View style={styles.quickGrid}>
          {QUICK_LINKS.map((link) => (
            <Pressable
              key={link.label}
              style={({ pressed }) => [styles.quickCard, pressed && { opacity: 0.7 }]}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              testID={`quick-link-${link.label.toLowerCase().replace(" ", "-")}`}
            >
              <View style={[styles.quickIcon, { backgroundColor: `${link.color}20` }]}>
                <Ionicons name={link.icon} size={22} color={link.color} />
              </View>
              <Text style={styles.quickLabel}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.addressCard}>
        <Ionicons name="location-outline" size={20} color={colors.primary} />
        <View style={styles.addressInfo}>
          <Text style={styles.addressTitle}>Find Us</Text>
          <Text style={styles.addressText}>
            Join us in person for worship, community, and growth.
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.directionsBtn, pressed && { opacity: 0.7 }]}
          onPress={() => Linking.openURL("https://maps.google.com")}
        >
          <Text style={styles.directionsBtnText}>Directions</Text>
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
      paddingBottom: isWeb ? 34 + 80 : insets.bottom + 80,
    },
    heroBanner: {
      paddingTop: isWeb ? 67 + 24 : insets.top + 24,
      paddingBottom: 32,
      paddingHorizontal: 24,
    },
    heroGreeting: {
      fontSize: 14,
      color: "rgba(255,255,255,0.6)",
      fontFamily: "Inter_400Regular",
      marginBottom: 4,
      letterSpacing: 0.5,
    },
    heroChurchName: {
      fontSize: 32,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: "#ffffff",
      marginBottom: 2,
    },
    heroTagline: {
      fontSize: 14,
      color: "#93c5fd",
      fontFamily: "Inter_500Medium",
      marginBottom: 20,
    },
    liveBtn: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: "#2563eb",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 100,
      gap: 8,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#f87171",
    },
    liveBtnText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
    },
    section: {
      paddingHorizontal: 16,
      marginTop: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 12,
    },
    serviceGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    serviceCard: {
      width: "47%",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    serviceIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    serviceDay: {
      fontSize: 13,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 1,
    },
    serviceTime: {
      fontSize: 20,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
      marginBottom: 2,
    },
    serviceLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    quickGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    quickCard: {
      width: "47%",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 14,
      alignItems: "flex-start",
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    quickIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    quickLabel: {
      fontSize: 13,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    addressCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 16,
      marginHorizontal: 16,
      marginTop: 24,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    addressInfo: {
      flex: 1,
    },
    addressTitle: {
      fontSize: 15,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 2,
    },
    addressText: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      lineHeight: 18,
    },
    directionsBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 100,
    },
    directionsBtnText: {
      color: "#ffffff",
      fontSize: 13,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
    },
  });
}
