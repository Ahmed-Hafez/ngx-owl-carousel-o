import { Injectable, OnDestroy } from '@angular/core';
import { Subscription, Observable, merge } from 'rxjs';
import { CarouselService } from './carousel.service';
import { tap } from 'rxjs/operators';

@Injectable()
export class AnimateService implements OnDestroy{
  /**
   * Subscrioption to merge Observable  from CarouselService
   */
  animateSubscription: Subscription;

  constructor(private carouselService: CarouselService) { }

  ngOnDestroy() {
    this.animateSubscription.unsubscribe();
  }

  /**
   * Defines Observables which service must observe
   */
  spyDataStreams() {
    const changeSettings$: Observable<any> = this.carouselService.getChangeState();

    const dragCarousel$: Observable<string> = this.carouselService.getDragState();
    const draggedCarousel$: Observable<string> = this.carouselService.getDraggedState();
    const translatedCarousel$: Observable<string> = this.carouselService.getTranslatedState();

    const translateCarousel$: Observable<string> = this.carouselService.getTranslateState();

    const dragTranslatedMerge$: Observable<string> = merge(dragCarousel$, draggedCarousel$, translatedCarousel$).pipe(
      tap()
    );
    const animateMerge$: Observable<string | any> = merge(changeSettings$, translateCarousel$, dragTranslatedMerge$).pipe();
    this.animateSubscription = animateMerge$.subscribe(
      () => {}
    );
  }
}
