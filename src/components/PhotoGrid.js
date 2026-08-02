import React, { useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { persistPhotoAsync } from '../lib/photoStorage';
import PhotoViewer from './PhotoViewer';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_SIZE = (SCREEN_WIDTH - 64 - 16) / 3;

export default function PhotoGrid({ photos = [], onPhotosChange, editable = true, showLabel = true }) {
  const C = useTheme();
  const [viewingUri, setViewingUri] = useState(null);

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('We need photo library access to add photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
      selectionLimit: 10,
    });
    if (!result.canceled) {
      const stored = await Promise.all(result.assets.map((asset) => persistPhotoAsync(asset.uri)));
      onPhotosChange([...photos, ...stored.filter(Boolean)]);
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('We need camera access to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) {
      const stored = await persistPhotoAsync(result.assets[0].uri);
      onPhotosChange([...photos, stored].filter(Boolean));
    }
  }

  function removePhoto(index) {
    onPhotosChange(photos.filter((_, i) => i !== index));
  }

  return (
    <View style={styles.container}>
      <PhotoViewer uri={viewingUri} onClose={() => setViewingUri(null)} />
      {showLabel && <Text style={[styles.label, { color: C.textSecondary }]}>photos</Text>}
      <View style={styles.grid}>
        {photos.map((uri, index) => (
          <View key={uri + index} style={styles.photoWrapper}>
            <TouchableOpacity onPress={() => setViewingUri(uri)} activeOpacity={0.85}>
              <Image source={{ uri }} style={styles.photo} />
            </TouchableOpacity>
            {editable && (
              <TouchableOpacity style={[styles.removeBtn, { backgroundColor: C.danger }]} onPress={() => removePhoto(index)}>
                <Ionicons name="close" size={12} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        ))}
        {editable && (
          <>
            <TouchableOpacity style={[styles.addBtn, { borderColor: C.border, backgroundColor: 'rgba(255,255,255,0.56)' }]} onPress={pickImage}>
              <Ionicons name="images-outline" size={22} color={C.primary} style={styles.addIcon} />
              <Text style={[styles.addText, { color: C.textSecondary }]}>gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addBtn, { borderColor: C.border, backgroundColor: 'rgba(255,255,255,0.56)' }]} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={22} color={C.primary} style={styles.addIcon} />
              <Text style={[styles.addText, { color: C.textSecondary }]}>camera</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 0 },
  label: { fontFamily: 'Rounded', fontSize: 13, fontWeight: '900', marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoWrapper: { position: 'relative' },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 16 },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: { marginBottom: 4 },
  addText: { fontFamily: 'Rounded', fontSize: 11, fontWeight: '900' },
});
