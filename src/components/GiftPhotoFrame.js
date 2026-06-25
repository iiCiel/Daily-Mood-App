import React, { useState } from 'react';
import { Alert, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

export default function GiftPhotoFrame({ C, style, imageStyle, compact = false }) {
  const [uri, setUri] = useState(null);
  const [picking, setPicking] = useState(false);
  const [viewing, setViewing] = useState(false);

  async function pickPhoto() {
    if (picking) return;
    setPicking(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Photo access needed', 'We need photo library access to add this photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Photo picker error', 'Close the app and try again. If this keeps happening, rebuild the Android app so the photo picker native module is registered.');
    } finally {
      setPicking(false);
    }
  }

  return (
    <>
      <TouchableOpacity
        onPress={uri ? () => setViewing(true) : pickPhoto}
        activeOpacity={0.82}
        style={[
          styles.frame,
          { backgroundColor: C.primaryLight, borderColor: uri ? 'transparent' : C.primary },
          style,
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={[styles.image, imageStyle]} resizeMode="contain" />
        ) : (
          <View style={[styles.empty, compact && styles.compactEmpty, { backgroundColor: C.white }]}>
            <Ionicons name={picking ? 'hourglass-outline' : 'images-outline'} size={compact ? 18 : 24} color={C.primary} />
            <Text style={[styles.emptyText, { color: C.primary }]}>Add photo</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={viewing} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewing(false)}>
        <View style={styles.viewer}>
          <Image source={{ uri }} style={styles.viewerImage} resizeMode="contain" />
          <View style={styles.viewerActions}>
            <TouchableOpacity style={[styles.viewerButton, { backgroundColor: C.white }]} onPress={() => {
              setViewing(false);
              setTimeout(pickPhoto, 300);
            }}>
              <Ionicons name="camera-outline" size={18} color={C.primary} />
              <Text style={[styles.viewerButtonText, { color: C.text }]}>Replace</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.viewerIconButton, { backgroundColor: C.white }]} onPress={() => setViewing(false)}>
              <Ionicons name="close" size={22} color={C.text} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    minHeight: 118,
    aspectRatio: 9 / 16,
    borderRadius: 22,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7D88B8',
    shadowOpacity: 0.13,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  empty: {
    minWidth: 122,
    minHeight: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  compactEmpty: {
    minWidth: 96,
    minHeight: 60,
  },
  emptyText: {
    fontFamily: 'Rounded',
    fontSize: 12,
    fontWeight: '900',
  },
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(12,12,24,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  viewerImage: {
    width: '100%',
    height: '82%',
  },
  viewerActions: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  viewerButton: {
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewerButtonText: {
    fontFamily: 'Rounded',
    fontSize: 13,
    fontWeight: '900',
  },
  viewerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
