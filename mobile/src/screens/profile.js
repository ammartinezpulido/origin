import React, { Component } from 'react'
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'

import Address from 'components/address'
import Avatar from 'components/avatar'
import IdentityQuery from '../queries/Identity'
import originWallet from '../OriginWallet'

const IMAGES_PATH = '../../assets/images/'

class ProfileScreen extends Component {
  static navigationOptions = ({ navigation }) => {
    return {
      headerTitleStyle: {
        fontFamily: 'Poppins',
        fontSize: 17,
        fontWeight: 'normal'
      }
    }
  }

  handlePress() {
    originWallet.open('profile')
  }

  render() {
    return (
      <Query query={IdentityQuery}>
        {({ data, loading, error }) => {
          if (loading || error) return null
          const profile = get(data, 'web3.account.identity') || {}

          return (
            <ScrollView
              style={styles.container}
              contentContainerStyle={styles.svContainer}
            >
              <Avatar
                image={profile.avatar}
                size={150}
                style={[styles.avatar, profile.avatar ? { paddingTop: 0 } : {}]}
              />
              <Address
                address={address}
                label="User Address"
                style={styles.address}
              />
              <Text style={styles.description}>
                {profile.description || 'An Origin user without a description'}
              </Text>
              {!!attestations.length && (
                <View style={styles.attestations}>
                  <Text style={styles.heading}>Verified</Text>
                  <View style={styles.services}>
                    {profile.phoneVerified && (
                      <View style={styles.attestation}>
                        <Image
                          source={require(`${IMAGES_PATH}phone-badge.png`)}
                          style={styles.badge}
                        />
                        <Text style={styles.label}>Phone</Text>
                      </View>
                    )}
                    {profile.emailVerified && (
                      <View style={styles.attestation}>
                        <Image
                          source={require(`${IMAGES_PATH}email-badge.png`)}
                          style={styles.badge}
                        />
                        <Text style={styles.label}>Email</Text>
                      </View>
                    )}
                    {profile.facebookVerified && (
                      <View style={styles.attestation}>
                        <Image
                          source={require(`${IMAGES_PATH}facebook-badge.png`)}
                          style={styles.badge}
                        />
                        <Text style={styles.label}>Facebook</Text>
                      </View>
                    )}
                    {profile.twitterVerified && (
                      <View style={styles.attestation}>
                        <Image
                          source={require(`${IMAGES_PATH}twitter-badge.png`)}
                          style={styles.badge}
                        />
                        <Text style={styles.label}>Twitter</Text>
                      </View>
                    )}
                    {profile.airbnbVerified && (
                      <View style={styles.attestation}>
                        <Image
                          source={require(`${IMAGES_PATH}airbnb-badge.png`)}
                          style={styles.badge}
                        />
                        <Text style={styles.label}>Airbnb</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          )
        }}
      </Query>
    )
  }
}

export default ProfileScreen

const styles = StyleSheet.create({
  address: {
    color: '#3e5d77',
    fontFamily: 'Lato',
    fontSize: 16,
    fontWeight: '300',
    marginBottom: 30
  },
  attestation: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingTop: 8,
    width: '50%'
  },
  attestations: {
    backgroundColor: '#ebf0f3',
    borderRadius: 20,
    padding: 20,
    width: '100%'
  },
  avatar: {
    borderRadius: 15,
    marginBottom: 15
  },
  badge: {
    height: 30,
    marginRight: 10,
    width: 30
  },
  container: {
    backgroundColor: '#f7f8f8',
    flex: 1
  },
  description: {
    color: '#111d28',
    fontFamily: 'Lato',
    fontSize: 18,
    fontWeight: '300',
    marginBottom: 30
  },
  heading: {
    color: '#0c2033',
    fontFamily: 'Lato',
    fontSize: 14,
    marginBottom: 8
  },
  label: {
    color: '#0c2033',
    fontFamily: 'Lato',
    fontSize: 14,
    fontWeight: '300'
  },
  services: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  svContainer: {
    alignItems: 'center',
    padding: 30
  }
})
