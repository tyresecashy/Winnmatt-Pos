// @ts-nocheck — archived mobile app, not part of active build
import React, { useState, useEffect, startTransition } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

interface CustomerProfile {
  name: string;
  loyalty_points: number;
  total_spent: number;
  tier: string;
  member_since: string;
}

interface RecentOrder {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  items_count: number;
}

interface LoyaltyReward {
  id: string;
  name: string;
  points_required: number;
  reward_type: string;
}

export default function CustomerDashboardScreen() {
  const navigation = useNavigation();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [availableRewards, setAvailableRewards] = useState<LoyaltyReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = async () => {
    try {
      // Mock data - in production, this would call the API
      const mockProfile: CustomerProfile = {
        name: 'John Doe',
        loyalty_points: 2450,
        total_spent: 125000,
        tier: 'gold',
        member_since: '2024-01-15',
      };

      const mockOrders: RecentOrder[] = [
        {
          id: '1',
          order_number: 'ORD-001',
          status: 'delivered',
          total: 3500,
          created_at: new Date().toISOString(),
          items_count: 5,
        },
        {
          id: '2',
          order_number: 'ORD-002',
          status: 'preparing',
          total: 2200,
          created_at: new Date(Date.now() - 86400000).toISOString(),
          items_count: 3,
        },
        {
          id: '3',
          order_number: 'ORD-003',
          status: 'delivered',
          total: 4800,
          created_at: new Date(Date.now() - 172800000).toISOString(),
          items_count: 8,
        },
      ];

      const mockRewards: LoyaltyReward[] = [
        {
          id: '1',
          name: '10% Discount',
          points_required: 1000,
          reward_type: 'discount',
        },
        {
          id: '2',
          name: 'Free Delivery',
          points_required: 500,
          reward_type: 'free_item',
        },
        {
          id: '3',
          name: 'KES 100 Cashback',
          points_required: 2000,
          reward_type: 'cashback',
        },
      ];

      setProfile(mockProfile);
      setRecentOrders(mockOrders);
      setAvailableRewards(mockRewards);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    startTransition(() => {
      loadDashboardData();
    });
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const formatCurrency = (amount: number) => {
    return `KES ${(amount / 100).toLocaleString()}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'confirmed':
      case 'preparing':
        return '#3b82f6';
      case 'ready':
        return '#8b5cf6';
      case 'delivered':
        return '#10b981';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze':
        return '#cd7f32';
      case 'silver':
        return '#c0c0c0';
      case 'gold':
        return '#ffd700';
      case 'platinum':
        return '#e5e4e2';
      default:
        return '#6b7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.name}</Text>
            <View style={styles.tierBadge}>
              <View style={[styles.tierDot, { backgroundColor: getTierColor(profile?.tier || '') }]} />
              <Text style={styles.tierText}>{profile?.tier?.toUpperCase()} MEMBER</Text>
            </View>
          </View>
        </View>

        <View style={styles.pointsSection}>
          <Text style={styles.pointsLabel}>Loyalty Points</Text>
          <Text style={styles.pointsValue}>{profile?.loyalty_points?.toLocaleString()}</Text>
          <Text style={styles.pointsSubtext}>
            Worth {formatCurrency((profile?.loyalty_points || 0) * 100)}
          </Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('OrderHistory')}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#dbeafe' }]}>
            <Ionicons name="receipt-outline" size={24} color="#3b82f6" />
          </View>
          <Text style={styles.actionText}>Orders</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('LoyaltyRewards')}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#fef3c7' }]}>
            <Ionicons name="gift-outline" size={24} color="#f59e0b" />
          </View>
          <Text style={styles.actionText}>Rewards</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('StoreLocator')}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#d1fae5' }]}>
            <Ionicons name="location-outline" size={24} color="#10b981" />
          </View>
          <Text style={styles.actionText}>Stores</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('MobileOrdering')}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#ede9fe' }]}>
            <Ionicons name="cart-outline" size={24} color="#8b5cf6" />
          </View>
          <Text style={styles.actionText}>Order</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Orders */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <TouchableOpacity onPress={() => navigation.navigate('OrderHistory')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {recentOrders.map((order) => (
          <TouchableOpacity
            key={order.id}
            style={styles.orderCard}
            onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
          >
            <View style={styles.orderHeader}>
              <Text style={styles.orderNumber}>{order.order_number}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                <Text style={styles.statusText}>{order.status.toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.orderDetails}>
              <Text style={styles.orderItems}>{order.items_count} items</Text>
              <Text style={styles.orderTotal}>{formatCurrency(order.total)}</Text>
            </View>
            <Text style={styles.orderDate}>
              {new Date(order.created_at).toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Available Rewards */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Available Rewards</Text>
          <TouchableOpacity onPress={() => navigation.navigate('LoyaltyRewards')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        {availableRewards.map((reward) => (
          <TouchableOpacity
            key={reward.id}
            style={styles.rewardCard}
            onPress={() => navigation.navigate('RedeemReward', { rewardId: reward.id })}
          >
            <View style={styles.rewardIcon}>
              <Ionicons
                name={reward.reward_type === 'discount' ? 'pricetag' : reward.reward_type === 'free_item' ? 'gift' : 'cash'}
                size={24}
                color="#3b82f6"
              />
            </View>
            <View style={styles.rewardInfo}>
              <Text style={styles.rewardName}>{reward.name}</Text>
              <Text style={styles.rewardPoints}>{reward.points_required} points</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tierText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  pointsSection: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  pointsLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  pointsValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  pointsSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#4b5563',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  seeAll: {
    fontSize: 14,
    color: '#3b82f6',
  },
  orderCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderItems: {
    fontSize: 14,
    color: '#6b7280',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  orderDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  rewardCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  rewardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  rewardPoints: {
    fontSize: 14,
    color: '#6b7280',
  },
});
