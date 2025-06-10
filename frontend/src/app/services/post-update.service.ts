import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Post } from '../models/post.model';

@Injectable({
  providedIn: 'root'
})
export class PostUpdateService {
  private postUpdateSubject = new Subject<{ handle: string; postId: number; updatedPost: Post }>();
  postUpdate$ = this.postUpdateSubject.asObservable();

  constructor() {}

  emitPostUpdate(handle: string, postId: number, updatedPost: Post): void {
    this.postUpdateSubject.next({ handle, postId, updatedPost });
  }
} 