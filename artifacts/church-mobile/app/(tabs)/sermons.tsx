import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import {
  ActivityIndicator,
  Image,
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

interface PublicSermon {
  id: number;
  title: string;
  speakerName: string | null;
  seriesName: string | null;
  description: string | null;
  youtubeVideoId: string;
  thumbnailUrl: string;
  youtubeUrl: string;
  sermonDate: string;
}

interface SermonsResponse {
  sermons: PublicSermon[];
}

async function fetchPublicSermons(): Promise<SermonsResponse> {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";
  const res = await fetch(`${baseUrl}/api/public/sermons`);
  if (!res.ok) throw new Error("Failed to fetch sermons");
  return res.json() as Promise<SermonsResponse>;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function SermonsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public-sermons"],
    queryFn: fetchPublicSermons,
    staleTime: 5 * 60 * 1000,
  });

  const sermons = data?.sermons ?? [];
  const styles = makeStyles(colors, insets, isWeb);

  const openYouTube = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void Linking.openURL(CJC_YOUTUBE_CHANNEL);
  };

  const openVideo = (url: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void Linking.openURL(url);
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.mutedForeground} />
        <Text style={styles.emptyTitle}>Couldn't load sermons</Text>
        <Text style={styles.emptySubtitle}>Check your connection and try again.</Text>
        <Pressable
          style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
          onPress={() => void refetch()}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (sermons.length === 0) {
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
            All sermons, Bible studies, and special services are available on our YouTube channel.
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
        <View style={styles.emptyCenter}>
          <Text style={styles.emptyTitle}>No sermons posted yet</Text>
          <Text style={styles.emptySubtitle}>Check back soon for the latest messages.</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionTitle}>Recent Sermons</Text>

      {sermons.map((sermon) => (
        <Pressable
          key={sermon.id}
          style={({ pressed }) => [styles.sermonCard, pressed && styles.pressed]}
          onPress={() => openVideo(sermon.youtubeUrl)}
        >
          <View style={styles.thumbnailWrapper}>
            <Image
              source={{ uri: sermon.thumbnailUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
            <View style={styles.playOverlay}>
              <Ionicons name="play-circle" size={40} color="#ffffff" />
            </View>
          </View>
          <View style={styles.sermonInfo}>
            {sermon.seriesName ? (
              <Text style={styles.seriesLabel} numberOfLines={1}>{sermon.seriesName}</Text>
            ) : null}
            <Text style={styles.sermonTitle} numberOfLines={2}>{sermon.title}</Text>
            {sermon.speakerName ? (
              <Text style={styles.sermonMeta} numberOfLines={1}>{sermon.speakerName}</Text>
            ) : null}
            <Text style={styles.sermonDate}>{formatDate(sermon.sermonDate)}</Text>
            {sermon.description ? (
              <Text style={styles.sermonDesc} numberOfLines={2}>{sermon.description}</Text>
            ) : null}
          </View>
        </Pressable>
      ))}

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.youtubeBtn, pressed && styles.pressed, styles.footerBtn]}
          onPress={openYouTube}
        >
          <Ionicons name="logo-youtube" size={18} color="#ffffff" />
          <Text style={styles.youtubeBtnText}>View All on YouTube</Text>
        </Pressable>
        <Text style={styles.footerText}>New messages every week. Subscribe to be notified.</Text>
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
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      padding: 24,
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
    sectionTitle: {
      fontSize: 20,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 16,
    },
    sermonCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    thumbnailWrapper: {
      position: "relative",
      width: "100%",
      aspectRatio: 16 / 9,
    },
    thumbnail: {
      width: "100%",
      height: "100%",
    },
    playOverlay: {
      position: "absolute",
      inset: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.25)",
    },
    sermonInfo: {
      padding: 16,
      gap: 4,
    },
    seriesLabel: {
      fontSize: 11,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    sermonTitle: {
      fontSize: 16,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      lineHeight: 22,
      marginBottom: 4,
    },
    sermonMeta: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
    },
    sermonDate: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    sermonDesc: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      lineHeight: 18,
      marginTop: 4,
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
    footer: {
      alignItems: "center",
      marginTop: 8,
      gap: 16,
      paddingBottom: 8,
    },
    footerBtn: {
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    footerText: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
    },
    emptyCenter: {
      alignItems: "center",
      paddingTop: 32,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      textAlign: "center",
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      maxWidth: 280,
      lineHeight: 20,
    },
    retryBtn: {
      marginTop: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 100,
    },
    retryText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
    },
  });
}
