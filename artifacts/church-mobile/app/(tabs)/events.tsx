import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface PublicEvent {
  id: number;
  title: string;
  eventType: string;
  description: string | null;
  startDatetime: string;
  endDatetime: string;
  location: string | null;
  eventMode: string | null;
  posterUrl: string | null;
}

interface EventsResponse {
  events: PublicEvent[];
}

async function fetchPublicEvents(): Promise<EventsResponse> {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";
  const res = await fetch(`${baseUrl}/api/public/events`);
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json() as Promise<EventsResponse>;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getMonthDay(isoString: string) {
  const date = new Date(isoString);
  return {
    month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: date.getDate().toString(),
  };
}

function EventCard({ event, colors }: { event: PublicEvent; colors: ReturnType<typeof useColors> }) {
  const { month, day } = getMonthDay(event.startDatetime);
  return (
    <View style={cardStyles(colors).card}>
      <View style={cardStyles(colors).dateBadge}>
        <Text style={cardStyles(colors).dateMonth}>{month}</Text>
        <Text style={cardStyles(colors).dateDay}>{day}</Text>
      </View>
      <View style={cardStyles(colors).info}>
        <Text style={cardStyles(colors).title} numberOfLines={2}>{event.title}</Text>
        <View style={cardStyles(colors).row}>
          <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
          <Text style={cardStyles(colors).meta}>
            {formatDate(event.startDatetime)} · {formatTime(event.startDatetime)}
          </Text>
        </View>
        {event.location ? (
          <View style={cardStyles(colors).row}>
            <Ionicons name="location-outline" size={13} color={colors.mutedForeground} />
            <Text style={cardStyles(colors).meta} numberOfLines={1}>{event.location}</Text>
          </View>
        ) : null}
        {event.eventMode ? (
          <View style={cardStyles(colors).badge}>
            <Text style={cardStyles(colors).badgeText}>
              {event.eventMode === "online" ? "Online" : event.eventMode === "hybrid" ? "Hybrid" : "In Person"}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function cardStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    dateBadge: {
      width: 52,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.muted,
      borderRadius: 10,
      paddingVertical: 8,
    },
    dateMonth: {
      fontSize: 10,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
      letterSpacing: 0.5,
    },
    dateDay: {
      fontSize: 22,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      lineHeight: 26,
    },
    info: {
      flex: 1,
      gap: 4,
    },
    title: {
      fontSize: 15,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 2,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    meta: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      flex: 1,
    },
    badge: {
      alignSelf: "flex-start",
      backgroundColor: colors.muted,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 100,
      marginTop: 2,
    },
    badgeText: {
      fontSize: 11,
      color: colors.primary,
      fontFamily: "Inter_500Medium",
    },
  });
}

export default function EventsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public-events"],
    queryFn: fetchPublicEvents,
    staleTime: 5 * 60 * 1000,
  });

  const events = data?.events ?? [];
  const styles = makeStyles(colors, insets, isWeb);

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
        <Text style={styles.emptyTitle}>Couldn't load events</Text>
        <Text style={styles.emptySubtitle}>Check your connection and try again.</Text>
        <Pressable
          style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
          onPress={() => refetch()}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={events}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => <EventCard event={item} colors={colors} />}
      contentContainerStyle={[
        styles.listContent,
        events.length === 0 && styles.emptyContainer,
      ]}
      style={{ backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
      scrollEnabled={events.length > 0}
      ListEmptyComponent={
        <View style={styles.emptyInner}>
          <Ionicons name="calendar-outline" size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>No upcoming events</Text>
          <Text style={styles.emptySubtitle}>
            Check back soon for upcoming services and special events.
          </Text>
        </View>
      }
    />
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: { top: number; bottom: number }, isWeb: boolean) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      padding: 24,
    },
    listContent: {
      paddingTop: isWeb ? 67 + 16 : 16,
      paddingBottom: isWeb ? 34 + 80 : insets.bottom + 80,
      paddingHorizontal: 16,
    },
    emptyContainer: {
      flex: 1,
    },
    emptyInner: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingTop: 60,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      maxWidth: 260,
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
