import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { Modal, StyleSheet, View } from "react-native";
import { Body, Button, H2 } from "./ui";
import { colors, radii, shadows, spacing } from "../../theme";
const KEY = "nyumbapap.analytics-consent.v1";
export function AnalyticsConsent() { const [visible,setVisible]=useState(false); useEffect(()=>{SecureStore.getItemAsync(KEY).then(value=>setVisible(!value));},[]); async function decide(value:"granted"|"denied"){await SecureStore.setItemAsync(KEY,value);setVisible(false);} return <Modal visible={visible} transparent animationType="slide"><View style={s.backdrop}><View style={s.panel}><H2>Your privacy choices</H2><Body>Essential storage keeps NyumbaPap secure. Optional analytics helps us understand which features work; it stays off unless you allow it.</Body><View style={s.actions}><Button secondary title="Decline analytics" onPress={()=>void decide("denied")} /><Button title="Allow analytics" onPress={()=>void decide("granted")} /></View></View></View></Modal>; }
const s=StyleSheet.create({backdrop:{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(8,35,29,.35)"},panel:{backgroundColor:colors.white,padding:22,gap:spacing.md,borderTopLeftRadius:radii.card,borderTopRightRadius:radii.card,...shadows.modal},actions:{gap:10}});
