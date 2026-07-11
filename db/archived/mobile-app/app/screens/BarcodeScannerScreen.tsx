import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface ScannedProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  current_stock: number;
  reorder_level: number;
  category: string;
  location: string;
}

export default function BarcodeScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanMode, setScanMode] = useState<'inventory' | 'stock_check' | 'price_check'>('inventory');

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarcodeScanned = async (barcode: string) => {
    if (!scanning) return;

    setScanning(false);
    setLoading(true);

    try {
      // In production, this would call the API
      // For now, using mock data
      const mockProduct: ScannedProduct = {
        id: Date.now().toString(),
        name: 'Sample Product',
        sku: barcode,
        price: 250,
        current_stock: 15,
        reorder_level: 10,
        category: 'Beverages',
        location: 'Aisle 1, Shelf 3',
      };
      setScannedProduct(mockProduct);
    } catch (error) {
      Alert.alert('Error', 'Product not found');
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntry = () => {
    if (manualBarcode.trim()) {
      handleBarcodeScanned(manualBarcode.trim());
      setManualBarcode('');
    }
  };

  const updateStock = async (action: 'add' | 'remove' | 'set', quantity: number) => {
    if (!scannedProduct) return;

    setLoading(true);
    try {
      // In production, this would call the API
      await new Promise((resolve) => setTimeout(resolve, 500));

      let newStock = scannedProduct.current_stock;
      if (action === 'add') newStock += quantity;
      if (action === 'remove') newStock -= quantity;
      if (action === 'set') newStock = quantity;

      setScannedProduct({
        ...scannedProduct,
        current_stock: Math.max(0, newStock),
      });

      Alert.alert('Success', `Stock updated to ${newStock}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update stock');
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setScannedProduct(null);
    setScanning(true);
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
          We need camera access to scan barcodes
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Scan Mode Selector */}
      <View style={styles.modeSelector}>
        {(['inventory', 'stock_check', 'price_check'] as const).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.modeTab, scanMode === mode && styles.modeTabActive]}
            onPress={() => setScanMode(mode)}
          >
            <Text
              style={[styles.modeTabText, scanMode === mode && styles.modeTabTextActive]}
            >
              {mode.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Camera View */}
      {!scannedProduct && (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            onBarcodeScanned={scanning ? ({ data }) => handleBarcodeScanned(data) : undefined}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
            }}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame} />
            <Text style={styles.scannerText}>Align barcode within frame</Text>
          </View>
        </View>
      )}

      {/* Manual Entry */}
      {!scannedProduct && (
        <View style={styles.manualEntryContainer}>
          <TextInput
            style={styles.manualInput}
            placeholder="Enter barcode manually"
            value={manualBarcode}
            onChangeText={setManualBarcode}
            keyboardType="numeric"
          />
          <TouchableOpacity style={styles.manualButton} onPress={handleManualEntry}>
            <Ionicons name="search" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Product Info */}
      {scannedProduct && (
        <View style={styles.productContainer}>
          <View style={styles.productHeader}>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{scannedProduct.name}</Text>
              <Text style={styles.productSku}>SKU: {scannedProduct.sku}</Text>
              <Text style={styles.productCategory}>{scannedProduct.category}</Text>
            </View>
            <View style={styles.productPrice}>
              <Text style={styles.priceLabel}>Price</Text>
              <Text style={styles.priceValue}>KES {scannedProduct.price}</Text>
            </View>
          </View>

          <View style={styles.stockInfo}>
            <View style={styles.stockItem}>
              <Text style={styles.stockLabel}>Current Stock</Text>
              <Text
                style={[
                  styles.stockValue,
                  scannedProduct.current_stock <= scannedProduct.reorder_level &&
                    styles.stockWarning,
                ]}
              >
                {scannedProduct.current_stock}
              </Text>
            </View>
            <View style={styles.stockItem}>
              <Text style={styles.stockLabel}>Reorder Level</Text>
              <Text style={styles.stockValue}>{scannedProduct.reorder_level}</Text>
            </View>
            <View style={styles.stockItem}>
              <Text style={styles.stockLabel}>Location</Text>
              <Text style={styles.stockValue}>{scannedProduct.location}</Text>
            </View>
          </View>

          {/* Stock Actions */}
          {scanMode === 'stock_check' && (
            <View style={styles.stockActions}>
              <Text style={styles.stockActionsTitle}>Update Stock</Text>
              <View style={styles.stockButtons}>
                <TouchableOpacity
                  style={[styles.stockButton, styles.removeButton]}
                  onPress={() => updateStock('remove', 1)}
                  disabled={loading}
                >
                  <Ionicons name="remove-circle" size={24} color="#ffffff" />
                  <Text style={styles.stockButtonText}>Remove</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.stockButton, styles.addButton]}
                  onPress={() => updateStock('add', 1)}
                  disabled={loading}
                >
                  <Ionicons name="add-circle" size={24} color="#ffffff" />
                  <Text style={styles.stockButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.scanAgainButton}
              onPress={resetScanner}
            >
              <Ionicons name="scan" size={20} color="#3b82f6" />
              <Text style={styles.scanAgainText}>Scan Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => Alert.alert('Done', 'Stock check completed')}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
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
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    padding: 8,
    gap: 8,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: '#3b82f6',
  },
  modeTabText: {
    fontSize: 14,
    color: '#9ca3af',
    textTransform: 'capitalize',
  },
  modeTabTextActive: {
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
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 280,
    height: 280,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  scannerText: {
    position: 'absolute',
    bottom: 40,
    color: '#ffffff',
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  manualEntryContainer: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    padding: 12,
    gap: 8,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
  },
  manualButton: {
    backgroundColor: '#3b82f6',
    width: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 16,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  productSku: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  productCategory: {
    fontSize: 14,
    color: '#3b82f6',
    marginTop: 4,
  },
  productPrice: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  stockInfo: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  stockItem: {
    flex: 1,
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  stockValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  stockWarning: {
    color: '#ef4444',
  },
  stockActions: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  stockActionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  stockButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  stockButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  addButton: {
    backgroundColor: '#10b981',
  },
  removeButton: {
    backgroundColor: '#ef4444',
  },
  stockButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  scanAgainButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
    gap: 8,
  },
  scanAgainText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
  },
  doneButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
