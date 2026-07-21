import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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

interface GivingChannel {
  id: string;
  name: string;
  description: string;
  iconSet: "ionicons" | "material";
  iconName: string;
  accentColor: string;
  action?: string;
  url?: string;
}

const GIVING_CHANNELS: GivingChannel[] = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Give securely online with a debit or credit card",
    iconSet: "ionicons",
    iconName: "card-outline",
    accentColor: "#2563eb",
    action: "Give Online",
  },
  {
    id: "paypal",
    name: "PayPal",
    description: "Send a gift through your PayPal account",
    iconSet: "ionicons",
    iconName: "logo-paypal",
    accentColor: "#003087",
    action: "Open PayPal",
    url: "https://paypal.me/cjcchurch",
  },
  {
    id: "cashapp",
    name: "Cash App",
    description: "Send via Cash App — fast, easy, and free",
    iconSet: "material",
    iconName: "currency-usd",
    accentColor: "#00d632",
    action: "Open Cash App",
    url: "https://cash.app/$cjcchurch",
  },
  {
    id: "venmo",
    name: "Venmo",
    description: "Transfer from your Venmo balance or bank",
    iconSet: "material",
    iconName: "alpha-v-circle-outline",
    accentColor: "#008cff",
    action: "Open Venmo",
    url: "https://venmo.com/cjcchurch",
  },
  {
    id: "zelle",
    name: "Zelle",
    description: "Send directly from your bank — no fees",
    iconSet: "material",
    iconName: "bank-transfer",
    accentColor: "#6d1ed4",
    action: "How to Zelle",
  },
];

function ChannelCard({
  channel,
  colors,
  onPress,
}: {
  channel: GivingChannel;
  colors: ReturnType<typeof useColors>;
  onPress: (channel: GivingChannel) => void;
}) {
  const styles = channelStyles(colors, channel.accentColor);
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress(channel)}
      testID={`give-channel-${channel.id}`}
    >
      <View style={styles.iconWrap}>
        {channel.iconSet === "ionicons" ? (
          <Ionicons name={channel.iconName as any} size={26} color={channel.accentColor} />
        ) : (
          <MaterialCommunityIcons name={channel.iconName as any} size={26} color={channel.accentColor} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{channel.name}</Text>
        <Text style={styles.desc}>{channel.description}</Text>
      </View>
      <View style={styles.actionWrap}>
        <Text style={[styles.action, { color: channel.accentColor }]}>{channel.action}</Text>
        <Ionicons name="chevron-forward" size={16} color={channel.accentColor} />
      </View>
    </Pressable>
  );
}

function channelStyles(colors: ReturnType<typeof useColors>, accent: string) {
  return StyleSheet.create({
    card: {
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
    pressed: {
      opacity: 0.7,
    },
    iconWrap: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    info: {
      flex: 1,
    },
    name: {
      fontSize: 16,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 2,
    },
    desc: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      lineHeight: 18,
    },
    actionWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    action: {
      fontSize: 12,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
    },
  });
}

export default function GiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const styles = makeStyles(colors, insets, isWeb);

  const handleChannelPress = (channel: GivingChannel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (channel.url) {
      Linking.openURL(channel.url);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="heart" size={28} color={colors.primary} />
        </View>
        <Text style={styles.headerTitle}>Give to CJC Church</Text>
        <Text style={styles.headerSubtitle}>
          Your generosity fuels the mission. Choose the giving method that works
          best for you — all options are safe and available 24/7.
        </Text>
      </View>

      <Text style={styles.sectionLabel}>GIVING OPTIONS</Text>

      {GIVING_CHANNELS.map((channel) => (
        <ChannelCard
          key={channel.id}
          channel={channel}
          colors={colors}
          onPress={handleChannelPress}
        />
      ))}

      <View style={styles.zelleNote}>
        <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
        <Text style={styles.zelleNoteText}>
          For Zelle, send to our registered church email. Contact us for details.
        </Text>
      </View>

      <View style={styles.scripture}>
        <Text style={styles.scriptureText}>
          "Each of you should give what you have decided in your heart to give,
          not reluctantly or under compulsion, for God loves a cheerful giver."
        </Text>
        <Text style={styles.scriptureRef}>— 2 Corinthians 9:7</Text>
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
    header: {
      alignItems: "center",
      marginBottom: 24,
      paddingVertical: 8,
    },
    headerIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 8,
      textAlign: "center",
    },
    headerSubtitle: {
      fontSize: 15,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      lineHeight: 22,
      maxWidth: 320,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      color: colors.mutedForeground,
      letterSpacing: 1.2,
      marginBottom: 10,
    },
    zelleNote: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      backgroundColor: colors.muted,
      borderRadius: 10,
      padding: 12,
      marginTop: 4,
      marginBottom: 20,
    },
    zelleNoteText: {
      flex: 1,
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      lineHeight: 18,
    },
    scripture: {
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      paddingLeft: 16,
      paddingVertical: 4,
      marginBottom: 8,
    },
    scriptureText: {
      fontSize: 14,
      fontStyle: "italic",
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      lineHeight: 20,
      marginBottom: 4,
    },
    scriptureRef: {
      fontSize: 13,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
    },
  });
}
