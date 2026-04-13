import { Platform, Share } from 'react-native';

export async function shareContent(message: string, title: string) {
  if (Platform.OS === 'web') {
    if (navigator.share) {
      await navigator.share({ title, text: message });
    } else {
      await navigator.clipboard.writeText(message);
      alert('Copied to clipboard!');
    }
  } else {
    await Share.share({ message, title });
  }
}
