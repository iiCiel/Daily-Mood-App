import React, { useState } from 'react';
import { View, Image, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import PhotoViewer from './PhotoViewer';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_SIZE = (SCREEN_WIDTH - 64 - 16) / 3;

export default function PhotoGrid({ photos = [], onPhotosChange, editable = true }) {
  const C = useTheme();
  const [viewingUri, setViewingUri] = useState(null);

  const pickImage = async () => {
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
      onPhotosChange([...photos, ...result.assets.map((a) => a.uri)]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('We need camera access to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) {
      onPhotosChange([...photos, result.assets[0].uri]);
    }
  };

  const removePhoto = (index) => onPhotosChange(photos.filter((_, i) => i !== index));

  return (
    <View style={styles.container}>
      <PhotoViewer uri={viewingUri} onClose={() => setViewingUri(null)} />
      <Text style={[styles.label, { color: C.textSecondary }]}>photos</Text>
      <View style={styles.grid}>
        {photos.map((uri, index) => (
          <View key={uri + index} style={styles.photoWrapper}>
            <TouchableOpacity onPress={() => setViewingUri(uri)} activeOpacity={0.85}>
              <Image source={{ uri }} style={styles.photo} />
            </TouchableOpacity>
            {editable && (
              <TouchableOpacity
                style={[styles.removeBtn, { backgroundColor: C.danger }]}
                onPress={() => removePhoto(index)}
              >
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {editable && (
          <>
            <TouchableOpacity
              style={[styles.addBtn, { borderColor: C.border }]}
              onPress={pickImage}
            >
              <Text style={styles.addIcon}>🖼</Text>
              <Text style={[styles.addText, { color: C.textSecondary }]}>gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addBtn, { borderColor: C.border }]}
              onPress={takePhoto}
            >
              <Text style={styles.addIcon}>📷</Text>
              <Text style={[styles.addText, { color: C.textSecondary }]}>camera</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  label: { fontSize: 13, marginBottom: 10, letterSpacing: 0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoWrapper: { position: 'relative' },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 12 },
  removeBtn: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  removeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  addBtn: {
    width: PHOTO_SIZE, height: PHOTO_SIZE,
    borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  addIcon: { fontSize: 22, marginBottom: 4 },
  addText: { fontSize: 11, letterSpacing: 0.2 },
});
