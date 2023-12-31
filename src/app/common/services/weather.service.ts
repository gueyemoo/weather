import { Injectable, Signal, inject, signal } from '@angular/core';
import { Observable, Subject, of, throwError } from 'rxjs';

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CurrentConditions } from '../../components/main-page/current-conditions/current-conditions.type';
import { ConditionsAndZip } from '../types/conditions-and-zip.type';
import { Forecast } from '../../components/forecasts-list/forecast.type';
import { StorageService } from './storage.service';
import { CURRENT_CONDITION_PREFIX, CURRENT_FORECAST_PREFIX } from '../utils/utils';
import { catchError, takeUntil, tap } from 'rxjs/operators';

@Injectable()
export class WeatherService {

  static URL = 'https://api.openweathermap.org/data/2.5';
  static APPID = '5a4b2d457ecbef9eb2a71e480b947604';
  static ICON_URL = 'https://raw.githubusercontent.com/udacity/Sunshine-Version-2/sunshine_master/app/src/main/res/drawable-hdpi/';

  private currentConditions = signal<ConditionsAndZip[]>([]);
  private storageService = inject(StorageService);
  private timeout = this.storageService.getTimeoutExpiration();
  private _destroyed$: Subject<void> = new Subject<void>();

  constructor(private http: HttpClient) { }

  /**
  * @description retrieve all the current conditions
  * @param zipcodes 
  */
  loadCurrentConditions(zipcodes: string[]): void {
    this.currentConditions.set([]); // prevent to put again the data on component init
    for (let zipcode of zipcodes) {
      this.addCurrentConditions(zipcode);
    }
  }

  /**
   * @description Add the current condition either from the local storage or from the API
   * if the data do not exist in the local storage and is valid
   * @param zipcode 
   */
  addCurrentConditions(zipcode: string): void {
    console.log('--------------NEW GET CONDITION CALL---------------');
    const keyValue = this.storageService.generateConcatKeyValue(zipcode, CURRENT_CONDITION_PREFIX);
    if (this.storageService.isKeyInLocalAndValid(keyValue, this.timeout)) {
      const existingCurrentCondition = JSON.parse(this.storageService.getDataFromLocal(keyValue));

      this.currentConditions.mutate((conditions) => {
        conditions.push({ zip: zipcode, ...existingCurrentCondition });
        console.log('conditions filled by local storage: ', conditions);
      });
    } else {
    // Here we make a request to get the current conditions data from the API. Note the use of backticks and an expression to insert the zipcode
      this.http.get<CurrentConditions>(`${WeatherService.URL}/weather?zip=${zipcode},us&units=imperial&APPID=${WeatherService.APPID}`)
        .pipe(
          catchError((error: HttpErrorResponse) => {
            // Handle the error from the API
            console.error('HTTP Error has been catched');
            return throwError(error);
          }),
          takeUntil(this._destroyed$)
        )
        .subscribe((data: CurrentConditions) => {
          // Handle successful request from the API
          this.storageService.setDataInLocalWithTime(keyValue, data);

          this.currentConditions.mutate(conditions => {
            conditions.push({ zip: zipcode, data });
            console.log('conditions filled by http: ', conditions);
          });
        });
    }
  };

  removeCurrentConditions(zipcode: string) {
    this.currentConditions.mutate(conditions => {
      for (let i in conditions) {
        if (conditions[i].zip == zipcode)
          conditions.splice(+i, 1);
      }
    })
  }

  getCurrentConditions(): Signal<ConditionsAndZip[]> {
    return this.currentConditions.asReadonly();
  }

  /**
   * @description retrieve the forecast data from the local storage or the API
   * if the data is not already in the local storage and valid
   * @param zipcode 
   */
  getForecast(zipcode: string): Observable<Forecast> {
    console.log('--------------NEW GET FORECAST CALL---------------');
    const keyValue = this.storageService.generateConcatKeyValue(zipcode, CURRENT_FORECAST_PREFIX);
    if (this.storageService.isKeyInLocalAndValid(keyValue, this.timeout)) {
      const localForecast = JSON.parse(this.storageService.getDataFromLocal(keyValue));
      console.log('forecast filled by local storage: ', localForecast.data);
      return of(localForecast.data);
    } else {
      // Here we make a request to get the forecast data from the API. Note the use of backticks and an expression to insert the zipcode
      return this.http.get<Forecast>(`${WeatherService.URL}/forecast/daily?zip=${zipcode},us&units=imperial&cnt=5&APPID=${WeatherService.APPID}`)
        .pipe(tap((data: Forecast) => {
          console.log('forecast filled by https: ', data);
          this.storageService.setDataInLocalWithTime(keyValue, data);
        }));
    }

  }

  getWeatherIcon(id): string {
    if (id >= 200 && id <= 232)
      return WeatherService.ICON_URL + "art_storm.png";
    else if (id >= 501 && id <= 511)
      return WeatherService.ICON_URL + "art_rain.png";
    else if (id === 500 || (id >= 520 && id <= 531))
      return WeatherService.ICON_URL + "art_light_rain.png";
    else if (id >= 600 && id <= 622)
      return WeatherService.ICON_URL + "art_snow.png";
    else if (id >= 801 && id <= 804)
      return WeatherService.ICON_URL + "art_clouds.png";
    else if (id === 741 || id === 761)
      return WeatherService.ICON_URL + "art_fog.png";
    else
      return WeatherService.ICON_URL + "art_clear.png";
  }

  /**
  * @description Unsubscribe to prevent any memory leak
  */
  ngOnDestroy() {
    this._destroyed$.next();
    this._destroyed$.complete();
  }
}
