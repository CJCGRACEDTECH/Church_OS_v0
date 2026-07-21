import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
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

const SERMON_SERIES = [
  {
    id: "1",
    title: "Faith Over Fear",
    description: "A 6-part series on walking boldly in Christ through life's uncertainties.",
    count: "6 messages",
  },
  {
    id: "2",
    title: "Rooted in Grace",
    description: "Discovering the depth of God's grace and how it transforms everyday living.",
    count: "4 messages",
  },
  {
    id: "3",
    title: "The Power of Prayer",
    description: "Practical teaching on building an effective, consistent prayer life.",
    count: "5 messages",
  },
];

export default function SermonsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const openYouTube = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(CJC_YOUTUBE_CHANNEL);
  };

  const styles = makeStyles(colors, insets, isWeb);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroIconWrapper}>
          <Ionicons name="play-circle" size={48} color={colors.primary} />
        </View>
        <Text style={styles.heroTitle}>Watch on YouTube</Text>
        <Text style={styles.heroSubtitle}>
          All sermons, Bible studies, and special services are available on our
          YouTube channel. Subscribe to stay up to date with the latest messages
          from CJC Church.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.youtubeBtn, pressed && styles.pressed]}
          onPress={openYouTube}
          testID="youtube-button"
        >
          <Ionicons name="logo-youtube" size={20} color="#ffffff" />
          <Text style={styles.youtubeBtnText}>Open YouTube Channel</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Recent Series</Text>

      {SERMON_SERIES.map((series) => (
        <Pressable
          key={series.id}
          style={({ pressed }) => [styles.seriesCard, pressed && styles.pressed]}
          onPress={openYouTube}
        >
          <View style={styles.seriesIcon}>
            <Ionicons name="book-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.seriesInfo}>
            <Text style={styles.seriesTitle}>{series.title}</Text>
            <Text style={styles.seriesDesc}>{series.description}</Text>
            <Text style={styles.seriesCount}>{series.count}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </Pressable>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          New messages every week. Subscribe to be notified.
        </Text>
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
      paddingHorizontal: 16,
    },
    heroCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 24,
      alignItems: "center",
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    heroIconWrapper: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      marginBottom: 8,
      textAlign: "center",
    },
    heroSubtitle: {
      fontSize: 15,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 20,
    },
    youtubeBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#ff0000",
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 100,
      gap: 8,
    },
    youtubeBtnText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
    },
    pressed: {
      opacity: 0.7,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 12,
    },
    seriesCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    seriesIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    seriesInfo: {
      flex: 1,
    },
    seriesTitle: {
      fontSize: 15,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 2,
    },
    seriesDesc: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      lineHeight: 18,
      marginBottom: 4,
    },
    seriesCount: {
      fontSize: 12,
      color: colors.primary,
      fontFamily: "Inter_500Medium",
    },
    footer: {
      alignItems: "center",
      marginTop: 16,
      paddingBottom: 8,
    },
    footerText: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
    },
  });
}
