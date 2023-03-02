import { Injectable } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { Capacitor, CapacitorHttp, HttpResponse } from '@capacitor/core';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { InAppBrowser } from './cordova-plugins';
import { HistoryService } from './history.service';
import { delay } from './util.service';

@Injectable({
  providedIn: 'root'
})
export class UrlService {

  constructor(private historyService: HistoryService) {
  }

  public async visit(url: string, save: boolean): Promise<string | undefined> {
    if (Capacitor.isNativePlatform()) {
      await Keyboard.hide();
    }
    if (Capacitor.isNativePlatform()) {
      if (Capacitor.getPlatform() === 'ios') {
        await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
      }
    }
    if (save) {
      await this.historyService.add(url);
    } else {
      // Used for exiting to home
      localStorage['capViewURL'] = window.location.href;
      localStorage['siteURL'] = url;
    }
    return await this.testUrl(url);
  }

  private async testUrl(url: string): Promise<string | undefined> {
    let hasRetried = false;
    let retry;
    do {
      try {
        retry = false;
        if (!Capacitor.isNativePlatform()) {
          window.open(url);
        } else {
          const response: HttpResponse = await CapacitorHttp.get({ url });
          if (response.status == 200) {
            if (this.isHttp(url) || this.allowed(url)) {
              window.location.href = url;
            } else {
              if (Capacitor.getPlatform() === 'ios') {
                await Browser.open({ url, toolbarColor: '111111' });
              } else {
                // The Capacitor Browser freezes the app so we use cordovas browser
                InAppBrowser.open(url, '_blank', 'location=no');
              }
              this.getIcon(url);
            }
          } else {
            return `${url} responded with the status code ${response.status}`;
          }
        }
      } catch (error) {
        console.error('er', error);
        const message = (error as any).message;

        if ((message == 'The Internet connection appears to be offline.') && !hasRetried) {
          // First installation shows a prompt to access local network. So we retry after that          
          retry = true;
          hasRetried = true;
          await delay(2500);
        } else {
          await this.historyService.remove(url);
          return message;
        }
      }
    }
    while (retry);
    return;
  }

  // Return if this site can be viewed in the app (true)
  // or will launch a browser window
  private allowed(url: string): boolean {
    return url?.includes('.appflowapp.com');
  }

  private getIcon(url: string) {
    this.historyService.setIcon(url);
  }

  private isHttp(url: string): boolean {
    return url.startsWith('http://');
  }
}