import React from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_SIZE = (SCREEN_WIDTH - 64 - 16) / 3;

export default function PhotoGrid({ photos = [], onPhotosChange, editable = true }) {
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('We need photo library access to add photos to your entries.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
      selectionLimit: 10,
    });

    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      onPhotosChange([...photos, ...newUris]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('We need camera access to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });

    if (!result.canceled) {
      onPhotosChange([...photos, result.assets[0].uri]);
    }
  };

  const removePhoto = (index) => {
    const updated = photos.filter((_, i) => i !== index);
    onPhotosChange(updated);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Photos</Text>
      <View style={styles.grid}>
        {photos.map((uri, index) => (
          <View key={uri + index} style={styles.photoWrapper}>
            <Image source={{ uri }} style={styles.photo} />
            {editable && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removePhoto(index)}
              >
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {editable && (
          <>
            <TouchableOpacity style={styles.addButton} onPress={pickImage}>
              <Text style={styles.addIcon}>🖼</Text>
              <Text style={styles.addText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={takePhoto}>
              <Text style={styles.addIcon}>📷</Text>
              <Text style={styles.addText}>Camera</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 12,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.danger,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  addButton: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  addText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});
