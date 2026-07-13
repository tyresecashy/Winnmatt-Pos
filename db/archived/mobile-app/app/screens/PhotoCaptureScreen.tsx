// @ts-nocheck — archived mobile app, not part of active build
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

interface Photo {
  id: string;
  uri: string;
  timestamp: string;
  type: 'before' | 'during' | 'after';
  notes?: string;
}

export default function PhotoCaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<'before' | 'during' | 'after'>('before');
  const cameraRef = useRef<CameraView>(null);

  const takePicture = async () => {
    if (!cameraRef.current) return;

    setLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      if (photo) {
        const newPhoto: Photo = {
          id: Date.now().toString(),
          uri: photo.uri,
          timestamp: new Date().toISOString(),
          type: selectedType,
        };
        setPhotos((prev) => [...prev, newPhoto]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (!result.canceled) {
      const newPhotos = result.assets.map((asset) => ({
        id: Date.now().toString() + Math.random().toString(),
        uri: asset.uri,
        timestamp: new Date().toISOString(),
        type: selectedType,
      }));
      setPhotos((prev) => [...prev, ...newPhotos]);
    }
  };

  const deletePhoto = (photoId: string) => {
    Alert.alert('Delete Photo', 'Are you sure you want to delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        },
      },
    ]);
  };

  const submitPhotos = async () => {
    if (photos.length === 0) {
      Alert.alert('Error', 'Please take at least one photo');
      return;
    }

    setLoading(true);
    try {
      // In production, this would upload to the server
      await new Promise((resolve) => setTimeout(resolve, 1000));
      Alert.alert('Success', `${photos.length} photos uploaded successfully`, [
        { text: 'OK', onPress: () => setPhotos([]) },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to upload photos');
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color="#6b7280" />
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionText}>
          We need camera access to take task completion photos
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Photo Type Selector */}
      <View style={styles.typeSelector}>
        {(['before', 'during', 'after'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.typeTab, selectedType === type && styles.typeTabActive]}
            onPress={() => setSelectedType(type)}
          >
            <Text
              style={[styles.typeTabText, selectedType === type && styles.typeTabTextActive]}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <CameraView style={styles.camera} ref={cameraRef} facing="back" />
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        )}
      </View>

      {/* Camera Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
          <Ionicons name="images" size={24} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.captureButton}
          onPress={takePicture}
          disabled={loading}
        >
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>
        <View style={styles.placeholder} />
      </View>

      {/* Photo Preview */}
      {photos.length > 0 && (
        <View style={styles.previewSection}>
          <Text style={styles.previewTitle}>Captured Photos ({photos.length})</Text>
          <ScrollView horizontal style={styles.photoList}>
            {photos.map((photo) => (
              <View key={photo.id} style={styles.photoItem}>
                <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} alt="" />
                <View style={styles.photoOverlay}>
                  <Text style={styles.photoType}>{photo.type}</Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deletePhoto(photo.id)}
                >
                  <Ionicons name="close-circle" size={24} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.submitButton} onPress={submitPhotos}>
            <Ionicons name="cloud-upload" size={20} color="#ffffff" />
            <Text style={styles.submitButtonText}>Upload {photos.length} Photos</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 32,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
  },
  permissionText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  permissionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    padding: 8,
    gap: 8,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  typeTabActive: {
    backgroundColor: '#3b82f6',
  },
  typeTabText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  typeTabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    paddingVertical: 20,
  },
  galleryButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ef4444',
  },
  placeholder: {
    width: 48,
    height: 48,
  },
  previewSection: {
    backgroundColor: '#1f2937',
    padding: 16,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  photoList: {
    marginBottom: 12,
  },
  photoItem: {
    width: 100,
    height: 100,
    marginRight: 12,
    position: 'relative',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  photoType: {
    fontSize: 10,
    color: '#ffffff',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  deleteButton: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
